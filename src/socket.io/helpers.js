'use strict';

var async = require('async');
var winston = require('winston');

var db = require('../database');
var websockets = require('./index');
var user = require('../user');
var posts = require('../posts');
var topics = require('../topics');
var privileges = require('../privileges');
var notifications = require('../notifications');
var plugins = require('../plugins');
var utils = require('../utils');

var SocketHelpers = module.exports;

SocketHelpers.notifyOnlineUsers = function (uid, result) {
	winston.warn('[deprecated] SocketHelpers.notifyOnlineUsers, consider using socketHelpers.notifyNew(uid, \'newPost\', result);');
	SocketHelpers.notifyNew(uid, 'newPost', result);
};

SocketHelpers.notifyNew = function (uid, type, result) {
	async.waterfall([
		function (next) {
			user.getUidsFromSet('users:online', 0, -1, next);
		},
		function (uids, next) {
			privileges.topics.filterUids('read', result.posts[0].topic.tid, uids, next);
		},
		function (uids, next) {
			filterTidCidIgnorers(uids, result.posts[0].topic.tid, result.posts[0].topic.cid, next);
		},
		function (uids, next) {
			user.blocks.filterUids(uid, uids, next);
		},
		function (uids, next) {
			user.blocks.filterUids(result.posts[0].topic.uid, uids, next);
		},
		function (uids, next) {
			plugins.fireHook('filter:sockets.sendNewPostToUids', { uidsTo: uids, uidFrom: uid, type: type }, next);
		},
	], function (err, data) {
		if (err) {
			return winston.error(err.stack);
		}

		result.posts[0].ip = undefined;

		data.uidsTo.forEach(function (toUid) {
			if (parseInt(toUid, 10) !== uid) {
				websockets.in('uid_' + toUid).emit('event:new_post', result);
				if (result.topic && type === 'newTopic') {
					websockets.in('uid_' + toUid).emit('event:new_topic', result.topic);
				}
			}
		});
	});
};

function filterTidCidIgnorers(uids, tid, cid, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				topicFollowed: function (next) {
					db.isSetMembers('tid:' + tid + ':followers', uids, next);
				},
				topicIgnored: function (next) {
					db.isSetMembers('tid:' + tid + ':ignorers', uids, next);
				},
				categoryIgnored: function (next) {
					db.sortedSetScores('cid:' + cid + ':ignorers', uids, next);
				},
			}, next);
		},
		function (results, next) {
			uids = uids.filter(function (uid, index) {
				return results.topicFollowed[index] ||
					(!results.topicFollowed[index] && !results.topicIgnored[index] && !results.categoryIgnored[index]);
			});
			next(null, uids);
		},
	], callback);
}

SocketHelpers.sendNotificationToPostOwner = function (pid, fromuid, command, notification) {
	if (!pid || !fromuid || !notification) {
		return;
	}
	fromuid = parseInt(fromuid, 10);
	var postData;
	async.waterfall([
		function (next) {
			posts.getPostFields(pid, ['tid', 'uid', 'content'], next);
		},
		function (_postData, next) {
			postData = _postData;
			async.parallel({
				canRead: async.apply(privileges.posts.can, 'read', pid, postData.uid),
				isIgnoring: async.apply(topics.isIgnoring, [postData.tid], postData.uid),
			}, next);
		},
		function (results, next) {
			if (!results.canRead || results.isIgnoring[0] || !postData.uid || fromuid === parseInt(postData.uid, 10)) {
				return;
			}
			async.parallel({
				username: async.apply(user.getUserField, fromuid, 'username'),
				topicTitle: async.apply(topics.getTopicField, postData.tid, 'title'),
				postObj: async.apply(posts.parsePost, postData),
			}, next);
		},
		function (results, next) {
			var title = utils.decodeHTMLEntities(results.topicTitle);
			var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

			notifications.create({
				type: command,
				bodyShort: '[[' + notification + ', ' + results.username + ', ' + titleEscaped + ']]',
				bodyLong: results.postObj.content,
				pid: pid,
				tid: postData.tid,
				path: '/post/' + pid,
				nid: command + ':post:' + pid + ':uid:' + fromuid,
				from: fromuid,
				mergeId: notification + '|' + pid,
				topicTitle: results.topicTitle,
			}, next);
		},
	], function (err, notification) {
		if (err) {
			return winston.error(err);
		}
		if (notification) {
			notifications.push(notification, [postData.uid]);
		}
	});
};


SocketHelpers.sendNotificationToTopicOwner = function (tid, fromuid, command, notification) {
	if (!tid || !fromuid || !notification) {
		return;
	}

	fromuid = parseInt(fromuid, 10);

	var ownerUid;
	async.waterfall([
		function (next) {
			async.parallel({
				username: async.apply(user.getUserField, fromuid, 'username'),
				topicData: async.apply(topics.getTopicFields, tid, ['uid', 'slug', 'title']),
			}, next);
		},
		function (results, next) {
			if (fromuid === parseInt(results.topicData.uid, 10)) {
				return;
			}
			ownerUid = results.topicData.uid;
			var title = utils.decodeHTMLEntities(results.topicData.title);
			var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

			notifications.create({
				bodyShort: '[[' + notification + ', ' + results.username + ', ' + titleEscaped + ']]',
				path: '/topic/' + results.topicData.slug,
				nid: command + ':tid:' + tid + ':uid:' + fromuid,
				from: fromuid,
			}, next);
		},
	], function (err, notification) {
		if (err) {
			return winston.error(err);
		}
		if (notification && parseInt(ownerUid, 10)) {
			notifications.push(notification, [ownerUid]);
		}
	});
};

SocketHelpers.upvote = function (data, notification) {
	if (!data || !data.post || !data.post.uid || !data.post.votes || !data.post.pid || !data.fromuid) {
		return;
	}

	var votes = data.post.votes;
	var touid = data.post.uid;
	var fromuid = data.fromuid;
	var pid = data.post.pid;

	var shouldNotify = {
		all: function () {
			return votes > 0;
		},
		first: function () {
			return votes === 1;
		},
		everyTen: function () {
			return votes > 0 && votes % 10 === 0;
		},
		threshold: function () {
			return [1, 5, 10, 25].indexOf(votes) !== -1 || (votes >= 50 && votes % 50 === 0);
		},
		logarithmic: function () {
			return votes > 1 && Math.log10(votes) % 1 === 0;
		},
		disabled: function () {
			return false;
		},
	};

	async.waterfall([
		function (next) {
			user.getSettings(touid, next);
		},
		function (settings, next) {
			var should = shouldNotify[settings.upvoteNotifFreq] || shouldNotify.all;

			if (should()) {
				SocketHelpers.sendNotificationToPostOwner(pid, fromuid, 'upvote', notification);
			}

			next();
		},
	], function (err) {
		if (err) {
			winston.error(err);
		}
	});
};

SocketHelpers.rescindUpvoteNotification = function (pid, fromuid) {
	var uid;
	async.waterfall([
		function (next) {
			notifications.rescind('upvote:post:' + pid + ':uid:' + fromuid, next);
		},
		function (next) {
			posts.getPostField(pid, 'uid', next);
		},
		function (_uid, next) {
			uid = _uid;
			user.notifications.getUnreadCount(uid, next);
		},
		function (count, next) {
			websockets.in('uid_' + uid).emit('event:notifications.updateCount', count);
			next();
		},
	], function (err) {
		if (err) {
			winston.error(err);
		}
	});
};

SocketHelpers.emitToTopicAndCategory = function (event, data) {
	websockets.in('topic_' + data.tid).emit(event, data);
	websockets.in('category_' + data.cid).emit(event, data);
};
