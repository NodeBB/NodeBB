

'use strict';

var async = require('async'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	plugins = require('../plugins'),
	utils = require('../../public/src/utils');


module.exports = function(Topics) {

	Topics.getTeasers = function(topics, callback) {
		if (!Array.isArray(topics) || !topics.length) {
			return callback(null, []);
		}

		var counts = [];
		var teaserPids = [];

		topics.forEach(function(topic) {
			counts.push(topic && (parseInt(topic.postcount, 10) || 0));
			if (topic && topic.teaserPid) {
				teaserPids.push(topic.teaserPid);
			}
		});

		posts.getPostsFields(teaserPids, ['pid', 'uid', 'timestamp', 'tid', 'content'], function(err, postData) {
			if (err) {
				return callback(err);
			}

			var uids = postData.map(function(post) {
				return post.uid;
			}).filter(function(uid, index, array) {
				return array.indexOf(uid) === index;
			});

			user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], function(err, usersData) {
				if (err) {
					return callback(err);
				}

				var users = {};
				usersData.forEach(function(user) {
					users[user.uid] = user;
				});
				var tidToPost = {};
				postData.forEach(function(post) {
					post.user = users[post.uid];
					post.timestamp = utils.toISOString(post.timestamp);
					tidToPost[post.tid] = post;
				});

				var teasers = topics.map(function(topic, index) {
					if (tidToPost[topic.tid]) {
						tidToPost[topic.tid].index = counts[index];
					}
					return tidToPost[topic.tid];
				});

				plugins.fireHook('filter:teasers.get', {teasers: teasers}, function(err, data) {
					callback(err, data ? data.teasers : null);
				});
			});
		});
	};

	Topics.getTeasersByTids = function(tids, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
		async.waterfall([
			function(next) {
				Topics.getTopicsFields(tids, ['tid', 'postcount', 'teaserPid'], next);
			},
			function(topics, next) {
				Topics.getTeasers(topics, next);
			}
		], callback);
	};

	Topics.getTeaser = function(tid, callback) {
		Topics.getTeasersByTids([tid], function(err, teasers) {
			callback(err, Array.isArray(teasers) && teasers.length ? teasers[0] : null);
		});
	};

	Topics.updateTeaser = function(tid, callback) {
		db.getSortedSetRevRange('tid:' + tid + ':posts', 0, 0, function(err, pids) {
			if (err) {
				return callback(err);
			}
			var pid = Array.isArray(pids) && pids.length ? pids[0] : null;
			Topics.setTopicField(tid, 'teaserPid', pid, callback);
		});
	};
};