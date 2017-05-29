
'use strict';

var async = require('async');

var db = require('../database');
var posts = require('../posts');
var privileges = require('../privileges');
var plugins = require('../plugins');
var meta = require('../meta');

module.exports = function (Topics) {
	Topics.createTopicFromPosts = function (uid, title, pids, fromTid, callback) {
		if (title) {
			title = title.trim();
		}

		if (title.length < parseInt(meta.config.minimumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
		} else if (title.length > parseInt(meta.config.maximumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]'));
		}

		if (!pids || !pids.length) {
			return callback(new Error('[[error:invalid-pid]]'));
		}

		pids.sort(function (a, b) {
			return a - b;
		});
		var mainPid = pids[0];
		var cid;
		var tid;
		async.waterfall([
			function (next) {
				posts.getCidByPid(mainPid, next);
			},
			function (_cid, next) {
				cid = _cid;
				async.parallel({
					postData: function (next) {
						posts.getPostData(mainPid, next);
					},
					isAdminOrMod: function (next) {
						privileges.categories.isAdminOrMod(cid, uid, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}
				Topics.create({ uid: results.postData.uid, title: title, cid: cid }, next);
			},
			function (results, next) {
				Topics.updateTopicBookmarks(fromTid, pids, function () { next(null, results); });
			},
			function (_tid, next) {
				tid = _tid;
				async.eachSeries(pids, function (pid, next) {
					privileges.posts.canEdit(pid, uid, function (err, canEdit) {
						if (err || !canEdit.flag) {
							return next(err || new Error(canEdit.message));
						}

						Topics.movePostToTopic(pid, tid, next);
					});
				}, next);
			},
			function (next) {
				Topics.updateTimestamp(tid, Date.now(), next);
			},
			function (next) {
				plugins.fireHook('action:topic.fork', { tid: tid, fromTid: fromTid, uid: uid });
				Topics.getTopicData(tid, next);
			},
		], callback);
	};

	Topics.movePostToTopic = function (pid, tid, callback) {
		var postData;
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				posts.getPostFields(pid, ['tid', 'uid', 'timestamp', 'upvotes', 'downvotes'], next);
			},
			function (post, next) {
				if (!post || !post.tid) {
					return next(new Error('[[error:no-post]]'));
				}

				if (parseInt(post.tid, 10) === parseInt(tid, 10)) {
					return next(new Error('[[error:cant-move-to-same-topic]]'));
				}

				postData = post;
				postData.pid = pid;

				Topics.removePostFromTopic(postData.tid, postData, next);
			},
			function (next) {
				async.parallel([
					function (next) {
						updateCategoryPostCount(postData.tid, tid, next);
					},
					function (next) {
						Topics.decreasePostCount(postData.tid, next);
					},
					function (next) {
						Topics.increasePostCount(tid, next);
					},
					function (next) {
						posts.setPostField(pid, 'tid', tid, next);
					},
					function (next) {
						Topics.addPostToTopic(tid, postData, next);
					},
				], next);
			},
			function (results, next) {
				async.parallel([
					async.apply(updateRecentTopic, tid),
					async.apply(updateRecentTopic, postData.tid),
				], function (err) {
					next(err);
				});
			},
			function (next) {
				plugins.fireHook('action:post.move', { post: postData, tid: tid });
				next();
			},
		], callback);
	};

	function updateCategoryPostCount(oldTid, tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicsFields([oldTid, tid], ['cid'], next);
			},
			function (topicData, next) {
				if (!topicData[0].cid || !topicData[1].cid) {
					return callback();
				}
				if (parseInt(topicData[0].cid, 10) === parseInt(topicData[1].cid, 10)) {
					return callback();
				}
				async.parallel([
					async.apply(db.incrObjectFieldBy, 'category:' + topicData[0].cid, 'post_count', -1),
					async.apply(db.incrObjectFieldBy, 'category:' + topicData[1].cid, 'post_count', 1),
				], next);
			},
		], callback);
	}

	function updateRecentTopic(tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestUndeletedPid(tid, next);
			},
			function (pid, next) {
				if (!pid) {
					return callback();
				}
				posts.getPostField(pid, 'timestamp', next);
			},
			function (timestamp, next) {
				Topics.updateTimestamp(tid, timestamp, next);
			},
		], callback);
	}
};
