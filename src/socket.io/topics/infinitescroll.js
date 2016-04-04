'use strict';

var async = require('async');
var user = require('../../user');
var topics = require('../../topics');
var privileges = require('../../privileges');
var meta = require('../../meta');
var utils = require('../../../public/src/utils');
var social = require('../../social');

module.exports = function(SocketTopics) {

	SocketTopics.loadMore = function(socket, data, callback) {
		if (!data || !data.tid || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0)  {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.parallel({
			privileges: function(next) {
				privileges.topics.get(data.tid, socket.uid, next);
			},
			settings: function(next) {
				user.getSettings(socket.uid, next);
			},
			topic: function(next) {
				topics.getTopicFields(data.tid, ['postcount', 'deleted'], next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!results.privileges.read || (parseInt(results.topic.deleted, 10) && !results.privileges.view_deleted)) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			var set = 'tid:' + data.tid + ':posts';
			if (results.settings.topicPostSort === 'most_votes') {
				set = 'tid:' + data.tid + ':posts:votes';
			}
			var reverse = results.settings.topicPostSort === 'newest_to_oldest' || results.settings.topicPostSort === 'most_votes';
			var start = Math.max(0, parseInt(data.after, 10));

			var infScrollPostsPerPage = 10;

			if (data.direction > 0) {
				if (reverse) {
					start = results.topic.postcount - start;
				}
			} else {
				if (reverse) {
					start = results.topic.postcount - start - infScrollPostsPerPage - 1;
				} else {
					start = start - infScrollPostsPerPage - 1;
				}
			}

			var stop = start + (infScrollPostsPerPage - 1);

			start = Math.max(0, start);
			stop = Math.max(0, stop);

			async.parallel({
				mainPost: function(next) {
					if (start > 0) {
						return next();
					}
					topics.getMainPost(data.tid, socket.uid, next);
				},
				posts: function(next) {
					topics.getTopicPosts(data.tid, set, start, stop, socket.uid, reverse, next);
				},
				postSharing: function (next) {
					social.getActivePostSharing(next);
				}
			}, function(err, topicData) {
				if (err) {
					return callback(err);
				}
				if (topicData.mainPost) {
					topicData.posts = [topicData.mainPost].concat(topicData.posts);
				}

				topicData.privileges = results.privileges;
				topicData['reputation:disabled'] = parseInt(meta.config['reputation:disabled'], 10) === 1;
				topicData['downvote:disabled'] = parseInt(meta.config['downvote:disabled'], 10) === 1;

				topics.modifyPostsByPrivilege(topicData, results.privileges);
				callback(null, topicData);
			});
		});
	};

	SocketTopics.loadMoreUnreadTopics = function(socket, data, callback) {
		if (!data || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var start = parseInt(data.after, 10),
			stop = start + 9;

		topics.getUnreadTopics(data.cid, socket.uid, start, stop, callback);
	};

	SocketTopics.loadMoreFromSet = function(socket, data, callback) {
		if (!data || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0 || !data.set) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		var start = parseInt(data.after, 10),
			stop = start + 9;

		topics.getTopicsFromSet(data.set, socket.uid, start, stop, callback);
	};

};