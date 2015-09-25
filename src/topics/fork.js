
'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	plugins = require('../plugins');


module.exports = function(Topics) {

	Topics.createTopicFromPosts = function(uid, title, pids, callback) {
		if (title) {
			title = title.trim();
		}

		if (!title) {
			return callback(new Error('[[error:invalid-title]]'));
		}

		if (!pids || !pids.length) {
			return callback(new Error('[[error:invalid-pid]]'));
		}

		pids.sort(function(a, b) {
			return a - b;
		});
		var mainPid = pids[0];
		var cid;
		var tid;
		async.waterfall([
			function(next) {
				posts.getCidByPid(mainPid, next);
			},
			function(_cid, next) {
				cid = _cid;
				async.parallel({
					postData: function(next) {
						posts.getPostData(mainPid, next);
					},
					isAdminOrMod: function(next) {
						privileges.categories.isAdminOrMod(cid, uid, next);
					}
				}, next);
			},
			function(results, next) {
				if (!results.isAdminOrMod) {
					return next(new Error('[[error:no-privileges]]'));
				}
				Topics.create({uid: results.postData.uid, title: title, cid: cid}, next);
			},
			function(_tid, next) {
				function move(pid, next) {
					privileges.posts.canEdit(pid, uid, function(err, canEdit) {
						if(err || !canEdit) {
							return next(err);
						}

						Topics.movePostToTopic(pid, tid, next);
					});
				}
				tid = _tid;
				async.eachSeries(pids, move, next);
			},
			function(next) {
				Topics.updateTimestamp(tid, Date.now(), next);
			},
			function(next) {
				Topics.getTopicData(tid, next);
			}
		], callback);
	};

	Topics.movePostToTopic = function(pid, tid, callback) {
		var postData;
		async.waterfall([
			function(next) {
				Topics.exists(tid, next);
			},
			function(exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				posts.getPostFields(pid, ['tid', 'timestamp', 'votes'], next);
			},
			function(post, next) {
				if (!post || !post.tid) {
					return next(new Error('[[error:no-post]]'));
				}

				if (parseInt(post.tid, 10) === parseInt(tid, 10)) {
					return next(new Error('[[error:cant-move-to-same-topic]]'));
				}

				postData = post;
				postData.pid = pid;

				Topics.removePostFromTopic(postData.tid, pid, next);
			},
			function(next) {
				async.parallel([
					function(next) {
						Topics.decreasePostCount(postData.tid, next);
					},
					function(next) {
						Topics.increasePostCount(tid, next);
					},
					function(next) {
						posts.setPostField(pid, 'tid', tid, next);
					},
					function(next) {
						Topics.addPostToTopic(tid, pid, postData.timestamp, postData.votes, next);
					}
				], next);
			},
			function(results, next) {
				async.parallel([
					async.apply(updateRecentTopic, tid),
					async.apply(updateRecentTopic, postData.tid)
				], next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:post.move', {post: postData, tid: tid});
			callback();
		});
	};

	function updateRecentTopic(tid, callback) {
		async.waterfall([
			function(next) {
				Topics.getLatestUndeletedPid(tid, next);
			},
			function(pid, next) {
				if (!pid) {
					return callback();
				}
				posts.getPostField(pid, 'timestamp', next);
			},
			function(timestamp, next) {
				Topics.updateTimestamp(tid, timestamp, next);
			}
		], callback);
	}


};
