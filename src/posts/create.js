'use strict';

var async = require('async');
var _ = require('underscore');

var meta = require('../meta');
var db = require('../database');
var plugins = require('../plugins');
var user = require('../user');
var topics = require('../topics');
var categories = require('../categories');


module.exports = function(Posts) {

	Posts.create = function(data, callback) {
		// This is an internal method, consider using Topics.reply instead
		var uid = data.uid;
		var tid = data.tid;
		var content = data.content.toString();
		var timestamp = data.timestamp || Date.now();

		if (!uid && parseInt(uid, 10) !== 0) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		var postData;

		async.waterfall([
			function(next) {
				db.incrObjectField('global', 'nextPid', next);
			},
			function(pid, next) {

				postData = {
					'pid': pid,
					'uid': uid,
					'tid': tid,
					'content': content,
					'timestamp': timestamp,
					'reputation': 0,
					'editor': '',
					'edited': 0,
					'deleted': 0
				};

				if (data.toPid) {
					postData.toPid = data.toPid;
				}

				if (data.ip && parseInt(meta.config.trackIpPerPost, 10) === 1) {
					postData.ip = data.ip;
				}

				if (parseInt(uid, 10) === 0 && data.handle) {
					postData.handle = data.handle;
				}

				plugins.fireHook('filter:post.save', postData, next);
			},
			function(_postData, next) {
				postData = _postData;
				db.setObject('post:' + postData.pid, postData, next);
			},
			function(next) {
				async.parallel([
					function(next) {
						user.onNewPostMade(postData, next);
					},
					function(next) {
						topics.onNewPostMade(postData, next);
					},
					function(next) {
						topics.getTopicFields(tid, ['cid', 'pinned'], function(err, topicData) {
							if (err) {
								return next(err);
							}
							postData.cid = topicData.cid;
							categories.onNewPostMade(topicData.cid, topicData.pinned, postData, next);
						});
					},
					function(next) {
						db.sortedSetAdd('posts:pid', timestamp, postData.pid, next);
					},
					function(next) {
						db.incrObjectField('global', 'postCount', next);
					}
				], function(err) {
					if (err) {
						return next(err);
					}
					plugins.fireHook('filter:post.get', postData, next);
				});
			},
			function(postData, next) {
				plugins.fireHook('action:post.save', _.clone(postData));
				next(null, postData);
			}
		], callback);
	};
};


