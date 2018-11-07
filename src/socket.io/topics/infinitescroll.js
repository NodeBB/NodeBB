'use strict';

var async = require('async');

var topics = require('../../topics');
var privileges = require('../../privileges');
var meta = require('../../meta');
var utils = require('../../utils');
var social = require('../../social');

module.exports = function (SocketTopics) {
	SocketTopics.loadMore = function (socket, data, callback) {
		if (!data || !data.tid || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		var userPrivileges;

		async.waterfall([
			function (next) {
				async.parallel({
					privileges: function (next) {
						privileges.topics.get(data.tid, socket.uid, next);
					},
					topic: function (next) {
						topics.getTopicFields(data.tid, ['postcount', 'deleted'], next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.privileges['topics:read'] || (results.topic.deleted && !results.privileges.view_deleted)) {
					return callback(new Error('[[error:no-privileges]]'));
				}

				userPrivileges = results.privileges;

				var set = 'tid:' + data.tid + ':posts';
				if (data.topicPostSort === 'most_votes') {
					set = 'tid:' + data.tid + ':posts:votes';
				}
				var reverse = data.topicPostSort === 'newest_to_oldest' || data.topicPostSort === 'most_votes';
				var start = Math.max(0, parseInt(data.after, 10));

				var infScrollPostsPerPage = Math.max(0, Math.min(meta.config.postsPerPage || 20, parseInt(data.count, 10) || meta.config.postsPerPage || 20) - 1);

				if (data.direction > 0) {
					if (reverse) {
						start = results.topic.postcount - start;
					}
				} else if (reverse) {
					start = results.topic.postcount - start - infScrollPostsPerPage;
				} else {
					start -= infScrollPostsPerPage;
				}

				var stop = start + (infScrollPostsPerPage);

				start = Math.max(0, start);
				stop = Math.max(0, stop);

				async.parallel({
					mainPost: function (next) {
						if (start > 0) {
							return next();
						}
						topics.getMainPost(data.tid, socket.uid, next);
					},
					posts: function (next) {
						topics.getTopicPosts(data.tid, set, start, stop, socket.uid, reverse, next);
					},
					postSharing: function (next) {
						social.getActivePostSharing(next);
					},
				}, next);
			},
			function (topicData, next) {
				if (topicData.mainPost) {
					topicData.posts = [topicData.mainPost].concat(topicData.posts);
				}

				topicData.privileges = userPrivileges;
				topicData['reputation:disabled'] = meta.config['reputation:disabled'] === 1;
				topicData['downvote:disabled'] = meta.config['downvote:disabled'] === 1;

				topics.modifyPostsByPrivilege(topicData, userPrivileges);
				next(null, topicData);
			},
		], callback);
	};

	SocketTopics.loadMoreSortedTopics = function (socket, data, callback) {
		if (!data || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		const { start, stop } = calculateStartStop(data);
		const params = {
			uid: socket.uid,
			start: start,
			stop: stop,
			filter: data.filter,
			query: data.query,
		};
		if (data.sort === 'unread') {
			params.cid = data.cid;
			return topics.getUnreadTopics(params, callback);
		}
		params.cids = data.cid;
		params.sort = data.sort;
		params.term = data.term;
		topics.getSortedTopics(params, callback);
	};

	SocketTopics.loadMoreFromSet = function (socket, data, callback) {
		if (!data || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0 || !data.set) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		const { start, stop } = calculateStartStop(data);
		topics.getTopicsFromSet(data.set, socket.uid, start, stop, callback);
	};

	function calculateStartStop(data) {
		var itemsPerPage = Math.min(meta.config.topicsPerPage || 20, parseInt(data.count, 10) || meta.config.topicsPerPage || 20);
		var start = Math.max(0, parseInt(data.after, 10));
		if (data.direction === -1) {
			start -= itemsPerPage;
		}
		var stop = start + Math.max(0, itemsPerPage - 1);
		return { start: Math.max(0, start), stop: Math.max(0, stop) };
	}
};
