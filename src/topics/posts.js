
'use strict';

const _ = require('lodash');
const validator = require('validator');
const nconf = require('nconf');

const db = require('../database');
const user = require('../user');
const posts = require('../posts');
const meta = require('../meta');
const plugins = require('../plugins');
const utils = require('../utils');

const backlinkRegex = new RegExp(`(?:${nconf.get('url').replace('/', '\\/')}|\b|\\s)\\/topic\\/(\\d+)(?:\\/\\w+)?`, 'g');

module.exports = function (Topics) {
	Topics.onNewPostMade = async function (postData) {
		await Topics.updateLastPostTime(postData.tid, postData.timestamp);
		await Topics.addPostToTopic(postData.tid, postData);
	};

	Topics.getTopicPosts = async function (topicData, set, start, stop, uid, reverse) {
		if (!topicData) {
			return [];
		}

		let repliesStart = start;
		let repliesStop = stop;
		if (stop > 0) {
			repliesStop -= 1;
			if (start > 0) {
				repliesStart -= 1;
			}
		}
		let pids = [];
		if (start !== 0 || stop !== 0) {
			pids = await posts.getPidsFromSet(set, repliesStart, repliesStop, reverse);
		}
		if (!pids.length && !topicData.mainPid) {
			return [];
		}

		if (topicData.mainPid && start === 0) {
			pids.unshift(topicData.mainPid);
		}
		let postData = await posts.getPostsByPids(pids, uid);
		if (!postData.length) {
			return [];
		}
		let replies = postData;
		if (topicData.mainPid && start === 0) {
			postData[0].index = 0;
			replies = postData.slice(1);
		}

		Topics.calculatePostIndices(replies, repliesStart);
		await addEventStartEnd(postData, set, reverse, topicData);
		const allPosts = postData.slice();
		postData = await user.blocks.filter(uid, postData);
		if (allPosts.length !== postData.length) {
			const includedPids = new Set(postData.map(p => p.pid));
			allPosts.reverse().forEach((p, index) => {
				if (!includedPids.has(p.pid) && allPosts[index + 1] && !reverse) {
					allPosts[index + 1].eventEnd = p.eventEnd;
				}
			});
		}

		const result = await plugins.hooks.fire('filter:topic.getPosts', {
			topic: topicData,
			uid: uid,
			posts: await Topics.addPostData(postData, uid),
		});
		return result.posts;
	};

	async function addEventStartEnd(postData, set, reverse, topicData) {
		if (!postData.length) {
			return;
		}
		postData.forEach((p, index) => {
			if (p && p.index === 0 && reverse) {
				p.eventStart = topicData.lastposttime;
				p.eventEnd = Date.now();
			} else if (p && postData[index + 1]) {
				p.eventStart = reverse ? postData[index + 1].timestamp : p.timestamp;
				p.eventEnd = reverse ? p.timestamp : postData[index + 1].timestamp;
			}
		});
		const lastPost = postData[postData.length - 1];
		if (lastPost) {
			lastPost.eventStart = reverse ? topicData.timestamp : lastPost.timestamp;
			lastPost.eventEnd = reverse ? lastPost.timestamp : Date.now();
			if (lastPost.index) {
				const nextPost = await db[reverse ? 'getSortedSetRevRangeWithScores' : 'getSortedSetRangeWithScores'](set, lastPost.index, lastPost.index);
				if (reverse) {
					lastPost.eventStart = nextPost.length ? nextPost[0].score : lastPost.eventStart;
				} else {
					lastPost.eventEnd = nextPost.length ? nextPost[0].score : lastPost.eventEnd;
				}
			}
		}
	}

	Topics.addPostData = async function (postData, uid) {
		if (!Array.isArray(postData) || !postData.length) {
			return [];
		}
		const pids = postData.map(post => post && post.pid);

		async function getPostUserData(field, method) {
			const uids = _.uniq(postData.filter(p => p && parseInt(p[field], 10) >= 0).map(p => p[field]));
			const userData = await method(uids);
			return _.zipObject(uids, userData);
		}
		const [
			bookmarks,
			voteData,
			userData,
			editors,
			replies,
		] = await Promise.all([
			posts.hasBookmarked(pids, uid),
			posts.getVoteStatusByPostIDs(pids, uid),
			getPostUserData('uid', async uids => await posts.getUserInfoForPosts(uids, uid)),
			getPostUserData('editor', async uids => await user.getUsersFields(uids, ['uid', 'username', 'userslug'])),
			getPostReplies(postData, uid),
			Topics.addParentPosts(postData),
		]);

		postData.forEach((postObj, i) => {
			if (postObj) {
				postObj.user = postObj.uid ? userData[postObj.uid] : { ...userData[postObj.uid] };
				postObj.editor = postObj.editor ? editors[postObj.editor] : null;
				postObj.bookmarked = bookmarks[i];
				postObj.upvoted = voteData.upvotes[i];
				postObj.downvoted = voteData.downvotes[i];
				postObj.votes = postObj.votes || 0;
				postObj.replies = replies[i];
				postObj.selfPost = parseInt(uid, 10) > 0 && parseInt(uid, 10) === postObj.uid;

				// Username override for guests, if enabled
				if (meta.config.allowGuestHandles && postObj.uid === 0 && postObj.handle) {
					postObj.user.username = validator.escape(String(postObj.handle));
					postObj.user.displayname = postObj.user.username;
				}
			}
		});

		const result = await plugins.hooks.fire('filter:topics.addPostData', {
			posts: postData,
			uid: uid,
		});
		return result.posts;
	};

	Topics.modifyPostsByPrivilege = function (topicData, topicPrivileges) {
		const loggedIn = parseInt(topicPrivileges.uid, 10) > 0;
		topicData.posts.forEach((post) => {
			if (post) {
				post.topicOwnerPost = parseInt(topicData.uid, 10) === parseInt(post.uid, 10);
				post.display_edit_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:edit']);
				post.display_delete_tools = topicPrivileges.isAdminOrMod || (post.selfPost && topicPrivileges['posts:delete']);
				post.display_moderator_tools = post.display_edit_tools || post.display_delete_tools;
				post.display_move_tools = topicPrivileges.isAdminOrMod && post.index !== 0;
				post.display_post_menu = topicPrivileges.isAdminOrMod ||
					(post.selfPost && !topicData.locked && !post.deleted) ||
					(post.selfPost && post.deleted && parseInt(post.deleterUid, 10) === parseInt(topicPrivileges.uid, 10)) ||
					((loggedIn || topicData.postSharing.length) && !post.deleted);
				post.ip = topicPrivileges.isAdminOrMod ? post.ip : undefined;

				posts.modifyPostByPrivilege(post, topicPrivileges);
			}
		});
	};

	Topics.addParentPosts = async function (postData) {
		let parentPids = postData.map(postObj => (postObj && postObj.hasOwnProperty('toPid') ? parseInt(postObj.toPid, 10) : null)).filter(Boolean);

		if (!parentPids.length) {
			return;
		}
		parentPids = _.uniq(parentPids);
		const parentPosts = await posts.getPostsFields(parentPids, ['uid']);
		const parentUids = _.uniq(parentPosts.map(postObj => postObj && postObj.uid));
		const userData = await user.getUsersFields(parentUids, ['username']);

		const usersMap = _.zipObject(parentUids, userData);
		const parents = {};
		parentPosts.forEach((post, i) => {
			if (usersMap[post.uid]) {
				parents[parentPids[i]] = {
					username: usersMap[post.uid].username,
					displayname: usersMap[post.uid].displayname,
				};
			}
		});

		postData.forEach((post) => {
			if (parents[post.toPid]) {
				post.parent = parents[post.toPid];
			}
		});
	};

	Topics.calculatePostIndices = function (posts, start) {
		posts.forEach((post, index) => {
			if (post) {
				post.index = start + index + 1;
			}
		});
	};

	Topics.getLatestUndeletedPid = async function (tid) {
		const pid = await Topics.getLatestUndeletedReply(tid);
		if (pid) {
			return pid;
		}
		const mainPid = await Topics.getTopicField(tid, 'mainPid');
		const mainPost = await posts.getPostFields(mainPid, ['pid', 'deleted']);
		return mainPost.pid && !mainPost.deleted ? mainPost.pid : null;
	};

	Topics.getLatestUndeletedReply = async function (tid) {
		let isDeleted = false;
		let index = 0;
		do {
			/* eslint-disable no-await-in-loop */
			const pids = await db.getSortedSetRevRange(`tid:${tid}:posts`, index, index);
			if (!pids.length) {
				return null;
			}
			isDeleted = await posts.getPostField(pids[0], 'deleted');
			if (!isDeleted) {
				return parseInt(pids[0], 10);
			}
			index += 1;
		} while (isDeleted);
	};

	Topics.addPostToTopic = async function (tid, postData) {
		const mainPid = await Topics.getTopicField(tid, 'mainPid');
		if (!parseInt(mainPid, 10)) {
			await Topics.setTopicField(tid, 'mainPid', postData.pid);
		} else {
			const upvotes = parseInt(postData.upvotes, 10) || 0;
			const downvotes = parseInt(postData.downvotes, 10) || 0;
			const votes = upvotes - downvotes;
			await db.sortedSetsAdd([
				`tid:${tid}:posts`, `tid:${tid}:posts:votes`,
			], [postData.timestamp, votes], postData.pid);
		}
		await Topics.increasePostCount(tid);
		await db.sortedSetIncrBy(`tid:${tid}:posters`, 1, postData.uid);
		const posterCount = await db.sortedSetCard(`tid:${tid}:posters`);
		await Topics.setTopicField(tid, 'postercount', posterCount);
		await Topics.updateTeaser(tid);
	};

	Topics.removePostFromTopic = async function (tid, postData) {
		await db.sortedSetsRemove([
			`tid:${tid}:posts`,
			`tid:${tid}:posts:votes`,
		], postData.pid);
		await Topics.decreasePostCount(tid);
		await db.sortedSetIncrBy(`tid:${tid}:posters`, -1, postData.uid);
		await db.sortedSetsRemoveRangeByScore([`tid:${tid}:posters`], '-inf', 0);
		const posterCount = await db.sortedSetCard(`tid:${tid}:posters`);
		await Topics.setTopicField(tid, 'postercount', posterCount);
		await Topics.updateTeaser(tid);
	};

	Topics.getPids = async function (tid) {
		let [mainPid, pids] = await Promise.all([
			Topics.getTopicField(tid, 'mainPid'),
			db.getSortedSetRange(`tid:${tid}:posts`, 0, -1),
		]);
		if (parseInt(mainPid, 10)) {
			pids = [mainPid].concat(pids);
		}
		return pids;
	};

	Topics.increasePostCount = async function (tid) {
		incrementFieldAndUpdateSortedSet(tid, 'postcount', 1, 'topics:posts');
	};

	Topics.decreasePostCount = async function (tid) {
		incrementFieldAndUpdateSortedSet(tid, 'postcount', -1, 'topics:posts');
	};

	Topics.increaseViewCount = async function (tid) {
		const cid = await Topics.getTopicField(tid, 'cid');
		incrementFieldAndUpdateSortedSet(tid, 'viewcount', 1, ['topics:views', `cid:${cid}:tids:views`]);
	};

	async function incrementFieldAndUpdateSortedSet(tid, field, by, set) {
		const value = await db.incrObjectFieldBy(`topic:${tid}`, field, by);
		await db[Array.isArray(set) ? 'sortedSetsAdd' : 'sortedSetAdd'](set, value, tid);
	}

	Topics.getTitleByPid = async function (pid) {
		return await Topics.getTopicFieldByPid('title', pid);
	};

	Topics.getTopicFieldByPid = async function (field, pid) {
		const tid = await posts.getPostField(pid, 'tid');
		return await Topics.getTopicField(tid, field);
	};

	Topics.getTopicDataByPid = async function (pid) {
		const tid = await posts.getPostField(pid, 'tid');
		return await Topics.getTopicData(tid);
	};

	Topics.getPostCount = async function (tid) {
		return await db.getObjectField(`topic:${tid}`, 'postcount');
	};

	async function getPostReplies(postData, callerUid) {
		const pids = postData.map(p => p && p.pid);
		const keys = pids.map(pid => `pid:${pid}:replies`);
		const [arrayOfReplyPids, userSettings] = await Promise.all([
			db.getSortedSetsMembers(keys),
			user.getSettings(callerUid),
		]);

		const uniquePids = _.uniq(_.flatten(arrayOfReplyPids));

		let replyData = await posts.getPostsFields(uniquePids, ['pid', 'uid', 'timestamp']);
		const result = await plugins.hooks.fire('filter:topics.getPostReplies', {
			uid: callerUid,
			replies: replyData,
		});
		replyData = await user.blocks.filter(callerUid, result.replies);

		const uids = replyData.map(replyData => replyData && replyData.uid);

		const uniqueUids = _.uniq(uids);

		const userData = await user.getUsersWithFields(uniqueUids, ['uid', 'username', 'userslug', 'picture'], callerUid);

		const uidMap = _.zipObject(uniqueUids, userData);
		const pidMap = _.zipObject(replyData.map(r => r.pid), replyData);
		const postDataMap = _.zipObject(pids, postData);

		const returnData = await Promise.all(arrayOfReplyPids.map(async (replyPids, idx) => {
			const currentPost = postData[idx];
			replyPids = replyPids.filter(pid => pidMap[pid]);
			const uidsUsed = {};
			const currentData = {
				hasMore: false,
				hasSingleImmediateReply: false,
				users: [],
				text: replyPids.length > 1 ? `[[topic:replies-to-this-post, ${replyPids.length}]]` : '[[topic:one-reply-to-this-post]]',
				count: replyPids.length,
				timestampISO: replyPids.length ? utils.toISOString(pidMap[replyPids[0]].timestamp) : undefined,
			};

			replyPids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

			replyPids.forEach((replyPid) => {
				const replyData = pidMap[replyPid];
				if (!uidsUsed[replyData.uid] && currentData.users.length < 6) {
					currentData.users.push(uidMap[replyData.uid]);
					uidsUsed[replyData.uid] = true;
				}
			});

			if (currentData.users.length > 5) {
				currentData.users.pop();
				currentData.hasMore = true;
			}

			if (replyPids.length === 1) {
				const currentIndex = currentPost ? currentPost.index : null;
				const replyPid = replyPids[0];
				// only load index of nested reply if we can't find it in the postDataMap
				let replyPost = postDataMap[replyPid];
				if (!replyPost) {
					const tid = await posts.getPostField(replyPid, 'tid');
					replyPost = {
						index: await posts.getPidIndex(replyPid, tid, userSettings.topicPostSort),
						tid: tid,
					};
				}
				currentData.hasSingleImmediateReply =
					(currentPost && currentPost.tid === replyPost.tid) &&
					Math.abs(currentIndex - replyPost.index) === 1;
			}

			return currentData;
		}));

		return returnData;
	}

	Topics.syncBacklinks = async (postData) => {
		if (!postData) {
			throw new Error('[[error:invalid-data]]');
		}


		let { content } = postData;
		// ignore lines that start with `>`
		content = content.split('\n').filter(line => !line.trim().startsWith('>')).join('\n');
		// Scan post content for topic links
		const matches = [...content.matchAll(backlinkRegex)];
		if (!matches) {
			return 0;
		}

		const { pid, uid, tid } = postData;
		let add = _.uniq(matches.map(match => match[1]).map(tid => parseInt(tid, 10)));

		const now = Date.now();
		const topicsExist = await Topics.exists(add);
		const current = (await db.getSortedSetMembers(`pid:${pid}:backlinks`)).map(tid => parseInt(tid, 10));
		const remove = current.filter(tid => !add.includes(tid));
		add = add.filter((_tid, idx) => topicsExist[idx] && !current.includes(_tid) && tid !== _tid);

		// Remove old backlinks
		await db.sortedSetRemove(`pid:${pid}:backlinks`, remove);

		// Add new backlinks
		await db.sortedSetAdd(`pid:${pid}:backlinks`, add.map(() => now), add);
		await Promise.all(add.map(async (tid) => {
			await Topics.events.log(tid, {
				uid,
				type: 'backlink',
				href: `/post/${pid}`,
			});
		}));

		return add.length + (current - remove);
	};
};
