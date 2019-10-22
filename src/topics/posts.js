
'use strict';

var _ = require('lodash');
var validator = require('validator');

var db = require('../database');
var user = require('../user');
var posts = require('../posts');
var meta = require('../meta');
var plugins = require('../plugins');
var utils = require('../../public/src/utils');

module.exports = function (Topics) {
	Topics.onNewPostMade = async function (postData) {
		await Topics.updateLastPostTime(postData.tid, postData.timestamp);
		await Topics.addPostToTopic(postData.tid, postData);
	};

	Topics.getTopicPosts = async function (tid, set, start, stop, uid, reverse) {
		const postData = await posts.getPostsFromSet(set, start, stop, uid, reverse);
		Topics.calculatePostIndices(postData, start);

		return await Topics.addPostData(postData, uid);
	};

	Topics.addPostData = async function (postData, uid) {
		if (!Array.isArray(postData) || !postData.length) {
			return [];
		}
		var pids = postData.map(post => post && post.pid);

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
			getPostUserData('uid', async function (uids) {
				return await posts.getUserInfoForPosts(uids, uid);
			}),
			getPostUserData('editor', async function (uids) {
				return await user.getUsersFields(uids, ['uid', 'username', 'userslug']);
			}),
			getPostReplies(pids, uid),
			Topics.addParentPosts(postData),
		]);

		postData.forEach(function (postObj, i) {
			if (postObj) {
				postObj.user = postObj.uid ? userData[postObj.uid] : _.clone(userData[postObj.uid]);
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
				}
			}
		});

		const result = await plugins.fireHook('filter:topics.addPostData', {
			posts: postData,
			uid: uid,
		});
		return result.posts;
	};

	Topics.modifyPostsByPrivilege = function (topicData, topicPrivileges) {
		var loggedIn = parseInt(topicPrivileges.uid, 10) > 0;
		topicData.posts.forEach(function (post) {
			if (post) {
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
		var parentPids = postData.map(function (postObj) {
			return postObj && postObj.hasOwnProperty('toPid') ? parseInt(postObj.toPid, 10) : null;
		}).filter(Boolean);

		if (!parentPids.length) {
			return;
		}
		parentPids = _.uniq(parentPids);
		const parentPosts = await posts.getPostsFields(parentPids, ['uid']);
		const parentUids = _.uniq(parentPosts.map(postObj => postObj && postObj.uid));
		const userData = await user.getUsersFields(parentUids, ['username']);

		var usersMap = {};
		userData.forEach(function (user) {
			usersMap[user.uid] = user.username;
		});
		var parents = {};
		parentPosts.forEach(function (post, i) {
			parents[parentPids[i]] = { username: usersMap[post.uid] };
		});

		postData.forEach(function (post) {
			post.parent = parents[post.toPid];
		});
	};

	Topics.calculatePostIndices = function (posts, start) {
		posts.forEach(function (post, index) {
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
		var isDeleted = false;
		var index = 0;
		do {
			/* eslint-disable no-await-in-loop */
			const pids = await db.getSortedSetRevRange('tid:' + tid + ':posts', index, index);
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
				'tid:' + tid + ':posts', 'tid:' + tid + ':posts:votes',
			], [postData.timestamp, votes], postData.pid);
		}
		await Topics.increasePostCount(tid);
		await db.sortedSetIncrBy('tid:' + tid + ':posters', 1, postData.uid);
		await Topics.updateTeaser(tid);
	};

	Topics.removePostFromTopic = async function (tid, postData) {
		await db.sortedSetsRemove([
			'tid:' + tid + ':posts',
			'tid:' + tid + ':posts:votes',
		], postData.pid);
		await Topics.decreasePostCount(tid);
		await db.sortedSetIncrBy('tid:' + tid + ':posters', -1, postData.uid);
		await Topics.updateTeaser(tid);
	};

	Topics.getPids = async function (tid) {
		var [mainPid, pids] = await Promise.all([
			Topics.getTopicField(tid, 'mainPid'),
			db.getSortedSetRange('tid:' + tid + ':posts', 0, -1),
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
		incrementFieldAndUpdateSortedSet(tid, 'viewcount', 1, 'topics:views');
	};

	async function incrementFieldAndUpdateSortedSet(tid, field, by, set) {
		const value = await db.incrObjectFieldBy('topic:' + tid, field, by);
		await db.sortedSetAdd(set, value, tid);
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
		return await db.getObjectField('topic:' + tid, 'postcount');
	};

	async function getPostReplies(pids, callerUid) {
		const keys = pids.map(pid => 'pid:' + pid + ':replies');
		const arrayOfReplyPids = await db.getSortedSetsMembers(keys);

		const uniquePids = _.uniq(_.flatten(arrayOfReplyPids));

		const replyData = await posts.getPostsFields(uniquePids, ['pid', 'uid', 'timestamp']);

		const uids = replyData.map(replyData => replyData && replyData.uid);

		const uniqueUids = _.uniq(uids);

		const userData = await user.getUsersWithFields(uniqueUids, ['uid', 'username', 'userslug', 'picture'], callerUid);

		var uidMap = _.zipObject(uniqueUids, userData);
		var pidMap = _.zipObject(uniquePids, replyData);

		var returnData = arrayOfReplyPids.map(function (replyPids) {
			var uidsUsed = {};
			var currentData = {
				hasMore: false,
				users: [],
				text: replyPids.length > 1 ? '[[topic:replies_to_this_post, ' + replyPids.length + ']]' : '[[topic:one_reply_to_this_post]]',
				count: replyPids.length,
				timestampISO: replyPids.length ? utils.toISOString(pidMap[replyPids[0]].timestamp) : undefined,
			};

			replyPids.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

			replyPids.forEach(function (replyPid) {
				var replyData = pidMap[replyPid];
				if (!uidsUsed[replyData.uid] && currentData.users.length < 6) {
					currentData.users.push(uidMap[replyData.uid]);
					uidsUsed[replyData.uid] = true;
				}
			});

			if (currentData.users.length > 5) {
				currentData.users.pop();
				currentData.hasMore = true;
			}

			return currentData;
		});

		return returnData;
	}
};
