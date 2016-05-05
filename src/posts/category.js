
'use strict';

var async = require('async');
var topics = require('../topics');

module.exports = function(Posts) {

	Posts.getCidByPid = function(pid, callback) {
		async.waterfall([
			function(next) {
				Posts.getPostField(pid, 'tid', next);
			},
			function(tid, next) {
				topics.getTopicField(tid, 'cid', next);
			}
		], callback);
	};

	Posts.getCidsByPids = function(pids, callback) {
		Posts.getPostsFields(pids, ['tid'], function(err, posts) {
			if (err) {
				return callback(err);
			}

			var tids = posts.map(function(post) {
				return post.tid;
			}).filter(function(tid, index, array) {
				return tid && array.indexOf(tid) === index;
			});

			topics.getTopicsFields(tids, ['cid'], function(err, topics) {
				if (err) {
					return callback(err);
				}

				var map = {};
				topics.forEach(function(topic, index) {
					if (topic) {
						map[tids[index]] = topic.cid;
					}
				});

				var cids = posts.map(function(post) {
					return map[post.tid];
				});

				callback(null, cids);
			});
		});
	};
};