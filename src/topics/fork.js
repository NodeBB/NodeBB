
'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),

	posts = require('../posts'),
	privileges = require('../privileges'),
	postTools = require('../postTools'),
	plugins = require('../plugins'),
	threadTools = require('../threadTools');


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

		pids.sort();
		var mainPid = pids[0];

		async.parallel({
			postData: function(callback) {
				posts.getPostData(mainPid, callback);
			},
			cid: function(callback) {
				posts.getCidByPid(mainPid, callback);
			}
		}, function(err, results) {
			Topics.create({uid: results.postData.uid, title: title, cid: results.cid}, function(err, tid) {
				if (err) {
					return callback(err);
				}

				async.eachSeries(pids, move, function(err) {
					if (err) {
						return callback(err);
					}

					Topics.updateTimestamp(tid, Date.now(), function(err) {
						if (err) {
							return callback(err);
						}
						Topics.getTopicData(tid, callback);
					});
				});

				function move(pid, next) {
					privileges.posts.canEdit(pid, uid, function(err, canEdit) {
						if(err || !canEdit) {
							return next(err);
						}

						Topics.movePostToTopic(pid, tid, next);
					});
				}
			});
		});
	};

	Topics.movePostToTopic = function(pid, tid, callback) {
		var postData;
		async.waterfall([
			function(next) {
				threadTools.exists(tid, next);
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
					return next(new Error('[[error:cant-move-to-same-topic]]'))
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
			}
		], function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:post.move', {post: postData, tid: tid});
			callback();
		});
	};
};
