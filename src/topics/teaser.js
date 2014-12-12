

'use strict';

var async = require('async'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	utils = require('../../public/src/utils');


module.exports = function(Topics) {

	Topics.getTeasers = function(tids, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		Topics.getTopicsFields(tids, ['postcount', 'teaserPid'], function(err, topics) {
			if (err) {
				return callback(err);
			}
			var counts = [];
			var teaserPids = [];

			topics.forEach(function(topic) {
				counts.push(topic && (parseInt(topic.postcount, 10) || 0));
				if (topic && topic.teaserPid) {
					teaserPids.push(topic.teaserPid);
				}
			});

			posts.getPostsFields(teaserPids, ['pid', 'uid', 'timestamp', 'tid'], function(err, postData) {
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

					var teasers = tids.map(function(tid, index) {
						if (tidToPost[tid]) {
							tidToPost[tid].index = counts[index];
						}
						return tidToPost[tid];
					});

					callback(null, teasers);
				});
			});
		});
	};

	Topics.getTeaser = function(tid, callback) {
		Topics.getTeasers([tid], function(err, teasers) {
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