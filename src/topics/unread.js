
'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var user = require('../user');
var posts = require('../posts');
var notifications = require('../notifications');
var categories = require('../categories');
var privileges = require('../privileges');
var meta = require('../meta');
var utils = require('../utils');
var plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.getTotalUnread = async function (uid, filter) {
		filter = filter || '';
		const counts = await Topics.getUnreadTids({ cid: 0, uid: uid, count: true });
		return counts && counts[filter];
	};

	Topics.getUnreadTopics = async function (params) {
		var unreadTopics = {
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

	Topics.unreadCutoff = function () {
		return Date.now() - (meta.config.unreadCutoff * 86400000);
	};

	Topics.getUnreadTids = async function (params) {
		const results = await Topics.getUnreadData(params);
		return params.count ? results.counts : results.tids;
	};

	Topics.getUnreadData = async function (params) {
		const uid = parseInt(params.uid, 10);
		const counts = {
			'': 0,
			new: 0,
			watched: 0,
			unreplied: 0,
		};
		const noUnreadData = {
			tids: [],
			counts: counts,
			tidsByFilter: {
				'': [],
				new: [],
				watched: [],
				unreplied: [],
			},
		};

		if (uid <= 0) {
			return noUnreadData;
		}

		params.filter = params.filter || '';

		var cutoff = params.cutoff || Topics.unreadCutoff();

		if (params.cid && !Array.isArray(params.cid)) {
			params.cid = [params.cid];
		}
		const [ignoredTids, recentTids, userScores, tids_unread] = await Promise.all([
			user.getIgnoredTids(uid, 0, -1),
			db.getSortedSetRevRangeByScoreWithScores('topics:recent', 0, -1, '+inf', cutoff),
			db.getSortedSetRevRangeByScoreWithScores('uid:' + uid + ':tids_read', 0, -1, '+inf', cutoff),
			db.getSortedSetRevRangeWithScores('uid:' + uid + ':tids_unread', 0, -1),
		]);

		if (recentTids && !recentTids.length && !tids_unread.length) {
			return noUnreadData;
		}

		const data = await filterTopics(params, {
			ignoredTids: ignoredTids,
			recentTids: recentTids,
			userScores: userScores,
			tids_unread: tids_unread,
		});
		const result = await plugins.fireHook('filter:topics.getUnreadTids', {
			uid: uid,
			tids: data.tids,
			counts: data.counts,
			tidsByFilter: data.tidsByFilter,
			cid: params.cid,
			filter: params.filter,
		});
		return result;
	};

	async function filterTopics(params, results) {
		const counts = {
			'': 0,
			new: 0,
			watched: 0,
			unreplied: 0,
		};

		const tidsByFilter = {
			'': [],
			new: [],
			watched: [],
			unreplied: [],
		};

		var userRead = {};
		results.userScores.forEach(function (userItem) {
			userRead[userItem.value] = userItem.score;
		});

		results.recentTids = results.recentTids.concat(results.tids_unread);
		results.recentTids.sort(function (a, b) {
			return b.score - a.score;
		});

		var tids = results.recentTids.filter(function (recentTopic) {
			if (results.ignoredTids.includes(String(recentTopic.value))) {
				return false;
			}
			return !userRead[recentTopic.value] || recentTopic.score > userRead[recentTopic.value];
		});

		tids = _.uniq(tids.map(topic => topic.value));

		var cid = params.cid;
		var uid = params.uid;
		var cids;
		var topicData;

		tids = tids.slice(0, 200);

		if (!tids.length) {
			return { counts: counts, tids: tids, tidsByFilter: tidsByFilter };
		}
		const blockedUids = await user.blocks.list(uid);

		tids = await filterTidsThatHaveBlockedPosts({
			uid: uid,
			tids: tids,
			blockedUids: blockedUids,
			recentTids: results.recentTids,
		});

		topicData = await Topics.getTopicsFields(tids, ['tid', 'cid', 'uid', 'postcount']);
		cids = _.uniq(topicData.map(topic => topic.cid)).filter(Boolean);

		const [isTopicsFollowed, categoryWatchState, readCids] = await Promise.all([
			db.sortedSetScores('uid:' + uid + ':followed_tids', tids),
			categories.getWatchState(cids, uid),
			privileges.categories.filterCids('read', cids, uid),
		]);
		cid = cid && cid.map(String);
		const readableCids = readCids.map(String);
		const userCidState = _.zipObject(cids, categoryWatchState);

		topicData.forEach(function (topic, index) {
			function cidMatch(topicCid) {
				return (!cid || (cid.length && cid.includes(String(topicCid)))) && readableCids.includes(String(topicCid));
			}

			if (topic && topic.cid && cidMatch(topic.cid) && !blockedUids.includes(parseInt(topic.uid, 10))) {
				topic.tid = parseInt(topic.tid, 10);
				if ((isTopicsFollowed[index] || userCidState[topic.cid] === categories.watchStates.watching)) {
					tidsByFilter[''].push(topic.tid);
				}

				if (isTopicsFollowed[index]) {
					tidsByFilter.watched.push(topic.tid);
				}

				if (topic.postcount <= 1) {
					tidsByFilter.unreplied.push(topic.tid);
				}

				if (!userRead[topic.tid]) {
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
		var userLastReadTimestamp = params.userLastReadTimestamp;
		if (!userLastReadTimestamp) {
			return true;
		}
		var start = 0;
		var count = 3;
		var done = false;
		var hasUnblockedUnread = params.topicTimestamp > userLastReadTimestamp;
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
			postData = postData.filter(function (post) {
				return !params.blockedUids.includes(parseInt(post.uid, 10));
			});

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
			db.sortedSetScores('topics:recent', tids),
			db.sortedSetScores('uid:' + uid + ':tids_read', tids),
		]);

		tids = tids.filter(function (tid, index) {
			return topicScores[index] && (!userScores[index] || userScores[index] < topicScores[index]);
		});

		if (!tids.length) {
			return false;
		}

		var now = Date.now();
		var scores = tids.map(() => now);
		const [topicData] = await Promise.all([
			Topics.getTopicsFields(tids, ['cid']),
			db.sortedSetAdd('uid:' + uid + ':tids_read', scores, tids),
			db.sortedSetRemove('uid:' + uid + ':tids_unread', tids),
		]);

		var cids = _.uniq(topicData.map(t => t && t.cid).filter(Boolean));
		await categories.markAsRead(cids, uid);

		plugins.fireHook('action:topics.markAsRead', { uid: uid, tids: tids });
		return true;
	};

	Topics.markAllRead = async function (uid) {
		const tids = await db.getSortedSetRevRangeByScore('topics:recent', 0, -1, '+inf', Topics.unreadCutoff());
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

		var cutoff = Topics.unreadCutoff();
		var result = tids.map(function (tid, index) {
			var read = !tids_unread[index] &&
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
		return tids.filter((tid, index) => tid && scores[index] <= 1);
	};
};
