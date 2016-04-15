'use strict';

var async = require('async');
var winston = require('winston');
var S = require('string');
var nconf = require('nconf');

var websockets = require('./index');
var user = require('../user');
var posts = require('../posts');
var topics = require('../topics');
var privileges = require('../privileges');
var notifications = require('../notifications');
var plugins = require('../plugins');

var SocketHelpers = {};

SocketHelpers.notifyOnlineUsers = function(uid, result) {
	winston.warn('[deprecated] SocketHelpers.notifyOnlineUsers, consider using socketHelpers.notifyNew(uid, \'newPost\', result);');
	SocketHelpers.notifyNew(uid, 'newPost', result);
};

SocketHelpers.notifyNew = function(uid, type, result) {
	async.waterfall([
		function(next) {
			user.getUidsFromSet('users:online', 0, -1, next);
		},
		function(uids, next) {
			privileges.topics.filterUids('read', result.posts[0].topic.tid, uids, next);
		},
		function(uids, next) {
			plugins.fireHook('filter:sockets.sendNewPostToUids', {uidsTo: uids, uidFrom: uid, type: type}, next);
		}
	], function(err, data) {
		if (err) {
			return winston.error(err.stack);
		}

		result.posts[0].ip = undefined;

		data.uidsTo.forEach(function(toUid) {
			if (parseInt(toUid, 10) !== uid) {
				websockets.in('uid_' + toUid).emit('event:new_post', result);
				if (result.topic && type === 'newTopic') {
					websockets.in('uid_' + toUid).emit('event:new_topic', result.topic);
				}
			}
		});
	});
};

SocketHelpers.sendNotificationToPostOwner = function(pid, fromuid, notification) {
	if (!pid || !fromuid || !notification) {
		return;
	}
	posts.getPostFields(pid, ['tid', 'uid', 'content'], function(err, postData) {
		if (err) {
			return;
		}

		if (!postData.uid || fromuid === parseInt(postData.uid, 10)) {
			return;
		}

		async.parallel({
			username: async.apply(user.getUserField, fromuid, 'username'),
			topicTitle: async.apply(topics.getTopicField, postData.tid, 'title'),
			postObj: async.apply(posts.parsePost, postData)
		}, function(err, results) {
			if (err) {
				return;
			}

			var title = S(results.topicTitle).decodeHTMLEntities().s;
			var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

			notifications.create({
				bodyShort: '[[' + notification + ', ' + results.username + ', ' + titleEscaped + ']]',
				bodyLong: results.postObj.content,
				pid: pid,
				nid: 'post:' + pid + ':uid:' + fromuid,
				from: fromuid,
				mergeId: notification + '|' + pid,
				topicTitle: results.topicTitle
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, [postData.uid]);
				}
			});
		});
	});
};


SocketHelpers.sendNotificationToTopicOwner = function(tid, fromuid, notification) {
	if (!tid || !fromuid || !notification) {
		return;
	}

	async.parallel({
		username: async.apply(user.getUserField, fromuid, 'username'),
		topicData: async.apply(topics.getTopicFields, tid, ['uid', 'slug', 'title']),
	}, function(err, results) {
		if (err || fromuid === parseInt(results.topicData.uid, 10)) {
			return;
		}

		var title = S(results.topicData.title).decodeHTMLEntities().s;
		var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

		notifications.create({
			bodyShort: '[[' + notification + ', ' + results.username + ', ' + titleEscaped + ']]',
			path: nconf.get('relative_path') + '/topic/' + results.topicData.slug,
			nid: 'tid:' + tid + ':uid:' + fromuid,
			from: fromuid
		}, function(err, notification) {
			if (!err && notification) {
				notifications.push(notification, [results.topicData.uid]);
			}
		});
	});
};

SocketHelpers.emitToTopicAndCategory = function(event, data) {
	websockets.in('topic_' + data.tid).emit(event, data);
	websockets.in('category_' + data.cid).emit(event, data);
};

module.exports = SocketHelpers;
