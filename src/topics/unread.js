
'use strict';

const async = require('async');
const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const posts = require('../posts');
const notifications = require('../notifications');
const categories = require('../categories');
const privileges = require('../privileges');
const meta = require('../meta');
const utils = require('../utils');
const plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.getTotalUnread = async function (uid, filter) {
		filter = filter || '';
		const counts = await Topics.getUnreadTids({ cid: 0, uid: uid, count: true });
		return counts && counts[filter];
	};

	Topics.getUnreadTopics = async function (params) {
		const unreadTopics = {
			showSelect: true,
			nextStart: 0,
			topics: [],
		};
		let tids = await Topics.getUnreadTids(params);
		unreadTopics.topicCount = tids.length;

		if (!tids.length) {
			return unreadTopics;
		}

		tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);

		const topicData = await Topics.getTopicsByTids(tids, params.uid);
		if (!topicData.length) {
			return unreadTopics;
		}
		Topics.calculateTopicIndices(topicData, params.start);
		unreadTopics.topics = topicData;
		unreadTopics.nextStart = params.stop + 1;
		return unreadTopics;
	};

	Topics.unreadCutoff = async function (uid) {
		const cutoff = Date.now() - (meta.config.unreadCutoff * 86400000);
		const data = await plugins.fireHook('filter:topics.unreadCutoff', { uid: uid, cutoff: cutoff });
		return parseInt(data.cutoff, 10);
	};

	Topics.getUnreadTids = async function (params) {
		const results = await Topics.getUnreadData(params);
		return params.count ? results.counts : results.tids;
	};

	Topics.getUnreadData = async function (params) {
		const uid = parseInt(params.uid, 10);

		params.filter = params.filter || '';

		if (params.cid && !Array.isArray(params.cid)) {
			params.cid = [params.cid];
		}

		const data = await getTids(params);
		if (uid <= 0 || !data.tids || !data.tids.length) {
			return data;
		}

		const result = await plugins.fireHook('filter:topics.getUnreadTids', {
			uid: uid,
			tids: data.tids,
			counts: data.counts,
			tidsByFilter: data.tidsByFilter,
			cid: params.cid,
			filter: params.filter,
			query: params.query || {},
		});
		return result;
	};

	async function getTids(params) {
		const counts = { '': 0,	new: 0,	watched: 0,	unreplied: 0 };
		const tidsByFilter = { '': [], new: [],	watched: [], unreplied: [] };

		if (params.uid <= 0) {
			return { counts: counts, tids: [], tidsByFilter: tidsByFilter };
		}

		params.cutoff = await Topics.unreadCutoff(params.uid);

		const [followedTids, ignoredTids, categoryTids, userScores, tids_unread] = await Promise.all([
			getFollowedTids(params),
			user.getIgnoredTids(params.uid, 0, -1),
			getCategoryTids(params),
			db.getSortedSetRevRangeByScoreWithScores('uid:' + params.uid + ':tids_read', 0, -1, '+inf', params.cutoff),
			db.getSortedSetRevRangeWithScores('uid:' + params.uid + ':tids_unread', 0, -1),
		]);

		const userReadTime = _.mapValues(_.keyBy(userScores, 'value'), 'score');
		const isTopicsFollowed = {};
		followedTids.forEach((t) => {
			isTopicsFollowed[t.value] = true;
		});
		const unreadFollowed = await db.isSortedSetMembers(
			'uid:' + params.uid + ':followed_tids', tids_unread.map(t => t.value)
		);

		tids_unread.forEach((t, i) => {
			isTopicsFollowed[t.value] = unreadFollowed[i];
		});

		const unreadTopics = _.unionWith(categoryTids, followedTids, (a, b) => a.value === b.value)
			.filter(t => !ignoredTids.includes(t.value) && (!userReadTime[t.value] || t.score > userReadTime[t.value]))
			.concat(tids_unread.filter(t => !ignoredTids.includes(t.value)))
			.sort((a, b) => b.score - a.score);

		let tids = _.uniq(unreadTopics.map(topic => topic.value)).slice(0, 200);

		if (!tids.length) {
			return { counts: counts, tids: tids, tidsByFilter: tidsByFilter };
		}

		const blockedUids = await user.blocks.list(params.uid);

		tids = await filterTidsThatHaveBlockedPosts({
			uid: params.uid,
			tids: tids,
			blockedUids: blockedUids,
			recentTids: categoryTids,
		});

		tids = await privileges.topics.filterTids('topics:read', tids, params.uid);
		const topicData = (await Topics.getTopicsFields(tids, ['tid', 'cid', 'uid', 'postcount', 'deleted'])).filter(t => !t.deleted);
		const topicCids = _.uniq(topicData.map(topic => topic.cid)).filter(Boolean);

		const categoryWatchState = await categories.getWatchState(topicCids, params.uid);
		const userCidState = _.zipObject(topicCids, categoryWatchState);

		const filterCids = params.cid && params.cid.map(cid => parseInt(cid, 10));

		topicData.forEach(function (topic) {
			if (topic && topic.cid && (!filterCids || filterCids.includes(topic.cid)) && !blockedUids.includes(topic.uid)) {
				if (isTopicsFollowed[topic.tid] || userCidState[topic.cid] === categories.watchStates.watching) {
					tidsByFilter[''].push(topic.tid);
				}

				if (isTopicsFollowed[topic.tid]) {
					tidsByFilter.watched.push(topic.tid);
				}

				if (topic.postcount <= 1) {
					tidsByFilter.unreplied.push(topic.tid);
				}

				if (!userReadTime[topic.tid]) {
					tidsByFilter.new.push(topic.tid);
				}
			}
		});

		counts[''] = tidsByFilter[''].length;
		counts.watched = tidsByFilter.watched.length;
		counts.unreplied = tidsByFilter.unreplied.length;
		counts.new = tidsByFilter.new.length;

		return {
			counts: counts,
			tids: tidsByFilter[params.filter],
			tidsByFilter: tidsByFilter,
		};
	}

	async function getCategoryTids(params) {
		if (plugins.hasListeners('filter:topics.unread.getCategoryTids')) {
			const result = await plugins.fireHook('filter:topics.unread.getCategoryTids', { params: params, tids: [] });
			return result.tids;
		}
		if (params.filter === 'watched') {
			return [];
		}
		const cids = params.cid || await user.getWatchedCategories(params.uid);
		const keys = cids.map(cid => 'cid:' + cid + ':tids:lastposttime');
		return await db.getSortedSetRevRangeByScoreWithScores(keys, 0, -1, '+inf', params.cutoff);
	}

	async function getFollowedTids(params) {
		let tids = await db.getSortedSetMembers('uid:' + params.uid + ':followed_tids');
		const filterCids = params.cid && params.cid.map(cid => parseInt(cid, 10));
		if (filterCids) {
			const topicData = await Topics.getTopicsFields(tids, ['tid', 'cid']);
			tids = topicData.filter(t => filterCids.includes(t.cid)).map(t => t.tid);
		}
		const scores = await db.sortedSetScores('topics:recent', tids);
		const data = tids.map((tid, index) => ({ value: String(tid), score: scores[index] }));
		return data.filter(item => item.score > params.cutoff);
	}

	async function filterTidsThatHaveBlockedPosts(params) {
		if (!params.blockedUids.length) {
			return params.tids;
		}
		const topicScores = _.mapValues(_.keyBy(params.recentTids, 'value'), 'score');

		const results = await db.sortedSetScores('uid:' + params.uid + ':tids_read', params.tids);

		const userScores = _.zipObject(params.tids, results);

		return await async.filter(params.tids, async function (tid) {
			return await doesTidHaveUnblockedUnreadPosts(tid, {
				blockedUids: params.blockedUids,
				topicTimestamp: topicScores[tid],
				userLastReadTimestamp: userScores[tid],
			});
		});
	}

	async function doesTidHaveUnblockedUnreadPosts(tid, params) {
		const userLastReadTimestamp = params.userLastReadTimestamp;
		if (!userLastReadTimestamp) {
			return true;
		}
		let start = 0;
		const count = 3;
		let done = false;
		let hasUnblockedUnread = params.topicTimestamp > userLastReadTimestamp;
		if (!params.blockedUids.length) {
			return hasUnblockedUnread;
		}
		while (!done) {
			/* eslint-disable no-await-in-loop */
			const pidsSinceLastVisit = await db.getSortedSetRangeByScore('tid:' + tid + ':posts', start, count, userLastReadTimestamp, '+inf');
			if (!pidsSinceLastVisit.length) {
				return hasUnblockedUnread;
			}
			let postData = await posts.getPostsFields(pidsSinceLastVisit, ['pid', 'uid']);
			postData = postData.filter(post => !params.blockedUids.includes(parseInt(post.uid, 10)));

			done = postData.length > 0;
			hasUnblockedUnread = postData.length > 0;
			start += count;
		}
		return hasUnblockedUnread;
	}

	Topics.pushUnreadCount = async function (uid) {
		if (!uid || parseInt(uid, 10) <= 0) {
			return;
		}
		const results = await Topics.getUnreadTids({ uid: uid, count: true });
		require('../socket.io').in('uid_' + uid).emit('event:unread.updateCount', {
			unreadTopicCount: results[''],
			unreadNewTopicCount: results.new,
			unreadWatchedTopicCount: results.watched,
			unreadUnrepliedTopicCount: results.unreplied,
		});
	};

	Topics.markAsUnreadForAll = async function (tid) {
		await Topics.markCategoryUnreadForAll(tid);
	};

	Topics.markAsRead = async function (tids, uid) {
		if (!Array.isArray(tids) || !tids.length) {
			return false;
		}

		tids = _.uniq(tids).filter(tid => tid && utils.isNumber(tid));

		if (!tids.length) {
			return false;
		}
		const [topicScores, userScores] = await Promise.all([
			Topics.getTopicsFields(tids, ['tid', 'lastposttime']),
			db.sortedSetScores('uid:' + uid + ':tids_read', tids),
		]);

		tids = topicScores.filter((t, i) => t.lastposttime && (!userScores[i] || userScores[i] < t.lastposttime))
			.map(t => t.tid);

		if (!tids.length) {
			return false;
		}

		const now = Date.now();
		const scores = tids.map(() => now);
		const [topicData] = await Promise.all([
			Topics.getTopicsFields(tids, ['cid']),
			db.sortedSetAdd('uid:' + uid + ':tids_read', scores, tids),
			db.sortedSetRemove('uid:' + uid + ':tids_unread', tids),
		]);

		const cids = _.uniq(topicData.map(t => t && t.cid).filter(Boolean));
		await categories.markAsRead(cids, uid);

		plugins.fireHook('action:topics.markAsRead', { uid: uid, tids: tids });
		return true;
	};

	Topics.markAllRead = async function (uid) {
		const cutoff = await Topics.unreadCutoff(uid);
		const tids = await db.getSortedSetRevRangeByScore('topics:recent', 0, -1, '+inf', cutoff);
		Topics.markTopicNotificationsRead(tids, uid);
		await Topics.markAsRead(tids, uid);
		await db.delete('uid:' + uid + ':tids_unread');
	};

	Topics.markTopicNotificationsRead = async function (tids, uid) {
		if (!Array.isArray(tids) || !tids.length) {
			return;
		}
		const nids = await user.notifications.getUnreadByField(uid, 'tid', tids);
		await notifications.markReadMultiple(nids, uid);
		user.notifications.pushCount(uid);
	};

	Topics.markCategoryUnreadForAll = async function (tid) {
		const cid = await Topics.getTopicField(tid, 'cid');
		await categories.markAsUnreadForAll(cid);
	};

	Topics.hasReadTopics = async function (tids, uid) {
		if (!(parseInt(uid, 10) > 0)) {
			return tids.map(() => false);
		}
		const [topicScores, userScores, tids_unread, blockedUids] = await Promise.all([
			db.sortedSetScores('topics:recent', tids),
			db.sortedSetScores('uid:' + uid + ':tids_read', tids),
			db.sortedSetScores('uid:' + uid + ':tids_unread', tids),
			user.blocks.list(uid),
		]);

		const cutoff = await Topics.unreadCutoff(uid);
		const result = tids.map(function (tid, index) {
			const read = !tids_unread[index] &&
				(topicScores[index] < cutoff ||
				!!(userScores[index] && userScores[index] >= topicScores[index]));
			return { tid: tid, read: read, index: index };
		});

		return await async.map(result, async function (data) {
			if (data.read) {
				return true;
			}
			const hasUnblockedUnread = await doesTidHaveUnblockedUnreadPosts(data.tid, {
				topicTimestamp: topicScores[data.index],
				userLastReadTimestamp: userScores[data.index],
				blockedUids: blockedUids,
			});
			if (!hasUnblockedUnread) {
				data.read = true;
			}
			return data.read;
		});
	};

	Topics.hasReadTopic = async function (tid, uid) {
		const hasRead = await Topics.hasReadTopics([tid], uid);
		return Array.isArray(hasRead) && hasRead.length ? hasRead[0] : false;
	};

	Topics.markUnread = async function (tid, uid) {
		const exists = await Topics.exists(tid);
		if (!exists) {
			throw new Error('[[error:no-topic]]');
		}
		await db.sortedSetRemove('uid:' + uid + ':tids_read', tid);
		await db.sortedSetAdd('uid:' + uid + ':tids_unread', Date.now(), tid);
	};

	Topics.filterNewTids = async function (tids, uid) {
		if (parseInt(uid, 10) <= 0) {
			return [];
		}
		const scores = await db.sortedSetScores('uid:' + uid + ':tids_read', tids);
		return tids.filter((tid, index) => tid && !scores[index]);
	};

	Topics.filterUnrepliedTids = async function (tids) {
		const scores = await db.sortedSetScores('topics:posts', tids);
		return tids.filter((tid, index) => tid && scores[index] !== null && scores[index] <= 1);
	};
};
