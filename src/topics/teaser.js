
'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var meta = require('../meta');
var user = require('../user');
var posts = require('../posts');
var plugins = require('../plugins');
var utils = require('../utils');

module.exports = function (Topics) {
	Topics.getTeasers = async function (topics, options) {
		if (!Array.isArray(topics) || !topics.length) {
			return [];
		}
		let uid = options;
		let teaserPost = meta.config.teaserPost;
		if (typeof options === 'object') {
			uid = options.uid;
			teaserPost = options.teaserPost || meta.config.teaserPost;
		}

		var counts = [];
		var teaserPids = [];
		var tidToPost = {};

		topics.forEach(function (topic) {
			counts.push(topic && topic.postcount);
			if (topic) {
				if (topic.teaserPid === 'null') {
					delete topic.teaserPid;
				}
				if (teaserPost === 'first') {
					teaserPids.push(topic.mainPid);
				} else if (teaserPost === 'last-post') {
					teaserPids.push(topic.teaserPid || topic.mainPid);
				} else { // last-reply and everything else uses teaserPid like `last` that was used before
					teaserPids.push(topic.teaserPid);
				}
			}
		});

		let postData = await posts.getPostsFields(teaserPids, ['pid', 'uid', 'timestamp', 'tid', 'content']);
		postData = postData.filter(post => post && post.pid);
		postData = await handleBlocks(uid, postData);
		postData = postData.filter(Boolean);
		const uids = _.uniq(postData.map(post => post.uid));

		const usersData = await user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture']);

		var users = {};
		usersData.forEach(function (user) {
			users[user.uid] = user;
		});
		postData.forEach(function (post) {
			// If the post author isn't represented in the retrieved users' data, then it means they were deleted, assume guest.
			if (!users.hasOwnProperty(post.uid)) {
				post.uid = 0;
			}

			post.user = users[post.uid];
			post.timestampISO = utils.toISOString(post.timestamp);
			tidToPost[post.tid] = post;
		});
		await Promise.all(postData.map(p => posts.parsePost(p)));

		const { tags } = await plugins.hooks.fire('filter:teasers.configureStripTags', { tags: utils.stripTags.concat(['img']) });

		var teasers = topics.map(function (topic, index) {
			if (!topic) {
				return null;
			}
			if (tidToPost[topic.tid]) {
				tidToPost[topic.tid].index = meta.config.teaserPost === 'first' ? 1 : counts[index];
				if (tidToPost[topic.tid].content) {
					tidToPost[topic.tid].content = utils.stripHTMLTags(replaceImgWithAltText(tidToPost[topic.tid].content), tags);
				}
			}
			return tidToPost[topic.tid];
		});

		const result = await plugins.hooks.fire('filter:teasers.get', { teasers: teasers, uid: uid });
		return result.teasers;
	};

	function replaceImgWithAltText(str) {
		return String(str).replace(/<img .*?alt="(.*?)"[^>]*>/gi, '$1');
	}

	async function handleBlocks(uid, teasers) {
		const blockedUids = await user.blocks.list(uid);
		if (!blockedUids.length) {
			return teasers;
		}

		return await async.mapSeries(teasers, async function (postData) {
			if (blockedUids.includes(parseInt(postData.uid, 10))) {
				return await getPreviousNonBlockedPost(postData, blockedUids);
			}
			return postData;
		});
	}

	async function getPreviousNonBlockedPost(postData, blockedUids) {
		let isBlocked = false;
		let prevPost = postData;
		const postsPerIteration = 5;
		let start = 0;
		let stop = start + postsPerIteration - 1;
		let checkedAllReplies = false;

		function checkBlocked(post) {
			const isPostBlocked = blockedUids.includes(parseInt(post.uid, 10));
			prevPost = !isPostBlocked ? post : prevPost;
			return isPostBlocked;
		}

		do {
			/* eslint-disable no-await-in-loop */
			let pids = await db.getSortedSetRevRange(`tid:${postData.tid}:posts`, start, stop);
			if (!pids.length) {
				checkedAllReplies = true;
				const mainPid = await Topics.getTopicField(postData.tid, 'mainPid');
				pids = [mainPid];
			}
			const prevPosts = await posts.getPostsFields(pids, ['pid', 'uid', 'timestamp', 'tid', 'content']);
			isBlocked = prevPosts.every(checkBlocked);
			start += postsPerIteration;
			stop = start + postsPerIteration - 1;
		} while (isBlocked && prevPost && prevPost.pid && !checkedAllReplies);

		return prevPost;
	}

	Topics.getTeasersByTids = async function (tids, uid) {
		if (!Array.isArray(tids) || !tids.length) {
			return [];
		}
		const topics = await Topics.getTopicsFields(tids, ['tid', 'postcount', 'teaserPid', 'mainPid']);
		return await Topics.getTeasers(topics, uid);
	};

	Topics.getTeaser = async function (tid, uid) {
		const teasers = await Topics.getTeasersByTids([tid], uid);
		return Array.isArray(teasers) && teasers.length ? teasers[0] : null;
	};

	Topics.updateTeaser = async function (tid) {
		let pid = await Topics.getLatestUndeletedReply(tid);
		pid = pid || null;
		if (pid) {
			await Topics.setTopicField(tid, 'teaserPid', pid);
		} else {
			await Topics.deleteTopicField(tid, 'teaserPid');
		}
	};
};
