
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
	var stripTeaserTags = utils.stripTags.concat(['img']);

	Topics.getTeasers = function (topics, uid, callback) {
		if (!Array.isArray(topics) || !topics.length) {
			return callback(null, []);
		}

		var counts = [];
		var teaserPids = [];
		var postData;
		var tidToPost = {};

		topics.forEach(function (topic) {
			counts.push(topic && topic.postcount);
			if (topic) {
				if (topic.teaserPid === 'null') {
					delete topic.teaserPid;
				}
				if (meta.config.teaserPost === 'first') {
					teaserPids.push(topic.mainPid);
				} else if (meta.config.teaserPost === 'last-post') {
					teaserPids.push(topic.teaserPid || topic.mainPid);
				} else { // last-reply and everything else uses teaserPid like `last` that was used before
					teaserPids.push(topic.teaserPid);
				}
			}
		});

		async.waterfall([
			function (next) {
				posts.getPostsFields(teaserPids, ['pid', 'uid', 'timestamp', 'tid', 'content'], next);
			},
			function (_postData, next) {
				_postData = _postData.filter(post => post && post.pid);
				handleBlocks(uid, _postData, next);
			},
			function (_postData, next) {
				postData = _postData.filter(Boolean);
				const uids = _.uniq(postData.map(post => post.uid));

				user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
			},
			function (usersData, next) {
				var users = {};
				usersData.forEach(function (user) {
					users[user.uid] = user;
				});

				async.each(postData, function (post, next) {
					// If the post author isn't represented in the retrieved users' data, then it means they were deleted, assume guest.
					if (!users.hasOwnProperty(post.uid)) {
						post.uid = 0;
					}

					post.user = users[post.uid];
					post.timestampISO = utils.toISOString(post.timestamp);
					tidToPost[post.tid] = post;
					posts.parsePost(post, next);
				}, next);
			},
			function (next) {
				var teasers = topics.map(function (topic, index) {
					if (!topic) {
						return null;
					}
					if (tidToPost[topic.tid]) {
						tidToPost[topic.tid].index = meta.config.teaserPost === 'first' ? 1 : counts[index];
						if (tidToPost[topic.tid].content) {
							tidToPost[topic.tid].content = utils.stripHTMLTags(tidToPost[topic.tid].content, stripTeaserTags);
						}
					}
					return tidToPost[topic.tid];
				});

				plugins.fireHook('filter:teasers.get', { teasers: teasers, uid: uid }, next);
			},
			function (data, next) {
				next(null, data.teasers);
			},
		], callback);
	};

	function handleBlocks(uid, teasers, callback) {
		user.blocks.list(uid, function (err, blockedUids) {
			if (err || !blockedUids.length) {
				return callback(err, teasers);
			}
			async.mapSeries(teasers, function (postData, nextPost) {
				if (blockedUids.includes(parseInt(postData.uid, 10))) {
					getPreviousNonBlockedPost(postData, blockedUids, nextPost);
				} else {
					setImmediate(nextPost, null, postData);
				}
			}, callback);
		});
	}

	function getPreviousNonBlockedPost(postData, blockedUids, callback) {
		let isBlocked = false;
		let prevPost = postData;
		const postsPerIteration = 5;
		let start = 0;
		let stop = start + postsPerIteration - 1;
		let checkedAllReplies = false;
		async.doWhilst(function (next) {
			async.waterfall([
				function (next) {
					db.getSortedSetRevRange('tid:' + postData.tid + ':posts', start, stop, next);
				},
				function (pids, next) {
					if (pids.length) {
						return next(null, pids);
					}

					checkedAllReplies = true;
					Topics.getTopicField(postData.tid, 'mainPid', function (err, mainPid) {
						next(err, [mainPid]);
					});
				},
				function (pids, next) {
					posts.getPostsFields(pids, ['pid', 'uid', 'timestamp', 'tid', 'content'], next);
				},
				function (prevPosts, next) {
					isBlocked = prevPosts.every(function (post) {
						const isPostBlocked = blockedUids.includes(parseInt(post.uid, 10));
						prevPost = !isPostBlocked ? post : prevPost;
						return isPostBlocked;
					});
					start += postsPerIteration;
					stop = start + postsPerIteration - 1;
					next();
				},
			], next);
		}, function () {
			return isBlocked && prevPost && prevPost.pid && !checkedAllReplies;
		}, function (err) {
			callback(err, prevPost);
		});
	}

	Topics.getTeasersByTids = function (tids, uid, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		async.waterfall([
			function (next) {
				Topics.getTopicsFields(tids, ['tid', 'postcount', 'teaserPid', 'mainPid'], next);
			},
			function (topics, next) {
				Topics.getTeasers(topics, uid, next);
			},
		], callback);
	};

	Topics.getTeaser = function (tid, uid, callback) {
		Topics.getTeasersByTids([tid], uid, function (err, teasers) {
			callback(err, Array.isArray(teasers) && teasers.length ? teasers[0] : null);
		});
	};

	Topics.updateTeaser = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestUndeletedReply(tid, next);
			},
			function (pid, next) {
				pid = pid || null;
				if (pid) {
					Topics.setTopicField(tid, 'teaserPid', pid, next);
				} else {
					Topics.deleteTopicField(tid, 'teaserPid', next);
				}
			},
		], callback);
	};
};
