

'use strict';

var async = require('async'),
	S = require('string'),

	db = require('../database'),
	user = require('../user'),
	posts = require('../posts'),
	plugins = require('../plugins'),
	postTools = require('../postTools'),
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

				async.each(postData, function(post, next) {
					post.user = users[post.uid];
					post.timestamp = utils.toISOString(post.timestamp);
					tidToPost[post.tid] = post;
					postTools.parsePost(post, next);
				}, function(err) {
					if (err) {
						return callback(err);
					}
					var teasers = topics.map(function(topic, index) {
						if (tidToPost[topic.tid]) {
							tidToPost[topic.tid].index = counts[index];
							if (tidToPost[topic.tid].content) {
								var s = S(tidToPost[topic.tid].content);
								tidToPost[topic.tid].content = s.stripTags.apply(s, utils.stripTags).s;
							}
						}
						return tidToPost[topic.tid];
					});

					plugins.fireHook('filter:teasers.get', {teasers: teasers}, function(err, data) {
						callback(err, data ? data.teasers : null);
					});
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
		Topics.getLatestUndeletedReply(tid, function(err, pid) {
			if (err) {
				return callback(err);
			}

			pid = pid || null;
			Topics.setTopicField(tid, 'teaserPid', pid, callback);
		});
	};
};