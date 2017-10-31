'use strict';

var async = require('async');

var db = require('../database');
var user = require('../user');
var meta = require('../meta');
var topics = require('../topics');
var notifications = require('../notifications');
var privileges = require('../privileges');
var plugins = require('../plugins');
var socketHelpers = require('../socket.io/helpers');

module.exports = function (Posts) {
	Posts.shouldQueue = function (uid, data, callback) {
		async.waterfall([
			function (next) {
				user.getUserFields(uid, ['reputation', 'postcount'], next);
			},
			function (userData, next) {
				var shouldQueue = parseInt(meta.config.postQueue, 10) === 1 && (!parseInt(uid, 10) || (parseInt(userData.reputation, 10) <= 0 && parseInt(userData.postcount, 10) <= 0));
				plugins.fireHook('filter:post.shouldQueue', {
					shouldQueue: shouldQueue,
					uid: uid,
					data: data,
				}, next);
			},
			function (result, next) {
				next(null, result.shouldQueue);
			},
		], callback);
	};

	Posts.addToQueue = function (data, callback) {
		var type = data.title ? 'topic' : 'reply';
		var id = type + '-' + Date.now();
		async.waterfall([
			function (next) {
				canPost(type, data, next);
			},
			function (next) {
				db.sortedSetAdd('post:queue', Date.now(), id, next);
			},
			function (next) {
				db.setObject('post:queue:' + id, {
					id: id,
					uid: data.uid,
					type: type,
					data: JSON.stringify(data),
				}, next);
			},
			function (next) {
				user.setUserField(data.uid, 'lastqueuetime', Date.now(), next);
			},
			function (next) {
				notifications.create({
					nid: 'post-queued-' + id,
					mergeId: 'post-queue',
					bodyShort: '[[notifications:post_awaiting_review]]',
					bodyLong: data.content,
					path: '/post-queue',
				}, next);
			},
			function (notification, next) {
				if (notification) {
					notifications.pushGroups(notification, ['administrators', 'Global Moderators'], next);
				} else {
					next();
				}
			},
			function (next) {
				next(null, {
					queued: true,
					message: '[[success:post-queued]]',
				});
			},
		], callback);
	};

	function canPost(type, data, callback) {
		async.waterfall([
			function (next) {
				if (type === 'topic') {
					next(null, data.cid);
				} else if (type === 'reply') {
					topics.getTopicField(data.tid, 'cid', next);
				}
			},
			function (cid, next) {
				async.parallel({
					canPost: function (next) {
						if (type === 'topic') {
							privileges.categories.can('topics:create', data.cid, data.uid, next);
						} else if (type === 'reply') {
							privileges.categories.can('topics:reply', cid, data.uid, next);
						}
					},
					isReadyToQueue: function (next) {
						user.isReadyToQueue(data.uid, cid, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.canPost) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			},
		], callback);
	}

	Posts.removeFromQueue = function (id, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetRemove('post:queue', id, next);
			},
			function (next) {
				db.delete('post:queue:' + id, next);
			},
			function (next) {
				notifications.rescind('post-queued-' + id, next);
			},
		], callback);
	};

	Posts.submitFromQueue = function (id, callback) {
		async.waterfall([
			function (next) {
				db.getObject('post:queue:' + id, next);
			},
			function (data, next) {
				if (!data) {
					return callback();
				}
				try {
					data.data = JSON.parse(data.data);
				} catch (err) {
					return next(err);
				}

				if (data.type === 'topic') {
					createTopic(data.data, next);
				} else if (data.type === 'reply') {
					createReply(data.data, next);
				}
			},
			function (next) {
				Posts.removeFromQueue(id, next);
			},
		], callback);
	};

	function createTopic(data, callback) {
		async.waterfall([
			function (next) {
				topics.post(data, next);
			},
			function (result, next) {
				socketHelpers.notifyNew(data.uid, 'newTopic', { posts: [result.postData], topic: result.topicData });
				next();
			},
		], callback);
	}

	function createReply(data, callback) {
		async.waterfall([
			function (next) {
				topics.reply(data, next);
			},
			function (postData, next) {
				var result = {
					posts: [postData],
					'reputation:disabled': parseInt(meta.config['reputation:disabled'], 10) === 1,
					'downvote:disabled': parseInt(meta.config['downvote:disabled'], 10) === 1,
				};
				socketHelpers.notifyNew(data.uid, 'newPost', result);
				next();
			},
		], callback);
	}
};
