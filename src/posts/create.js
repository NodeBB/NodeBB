'use strict';

var async = require('async'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins'),
	user = require('../user'),
	topics = require('../topics'),
	categories = require('../categories');


module.exports = function(Posts) {
	Posts.create = function(data, callback) {
		var uid = data.uid,
			tid = data.tid,
			content = data.content,
			timestamp = data.timestamp || Date.now();

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
					'votes': 0,
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
			function(postData, next) {
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
						categories.onNewPostMade(postData, next);
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
				plugins.fireHook('action:post.save', postData);
				next(null, postData);
			}
		], callback);
	};
};


