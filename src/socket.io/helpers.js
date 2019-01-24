'use strict';

var async = require('async');
var winston = require('winston');
var _ = require('lodash');

var db = require('../database');
var websockets = require('./index');
var user = require('../user');
var posts = require('../posts');
var topics = require('../topics');
var categories = require('../categories');
var privileges = require('../privileges');
var notifications = require('../notifications');
var plugins = require('../plugins');
var utils = require('../utils');

var SocketHelpers = module.exports;

SocketHelpers.notifyNew = function (uid, type, result) {
	let watchStateUids;
	let categoryWatchStates;
	let topicFollowState;
	const post = result.posts[0];
	const tid = post.topic.tid;
	const cid = post.topic.cid;
	async.waterfall([
		function (next) {
			user.getUidsFromSet('users:online', 0, -1, next);
		},
		function (uids, next) {
			uids = uids.filter(toUid => parseInt(toUid, 10) !== uid);
			privileges.topics.filterUids('read', tid, uids, next);
		},
		function (uids, next) {
			watchStateUids = uids;
			getWatchStates(watchStateUids, tid, cid, next);
		},
		function (watchStates, next) {
			categoryWatchStates = _.zipObject(watchStateUids, watchStates.categoryWatchStates);
			topicFollowState = _.zipObject(watchStateUids, watchStates.topicFollowed);
			const uids = filterTidCidIgnorers(watchStateUids, watchStates);
			user.blocks.filterUids(uid, uids, next);
		},
		function (uids, next) {
			user.blocks.filterUids(post.topic.uid, uids, next);
		},
		function (uids, next) {
			plugins.fireHook('filter:sockets.sendNewPostToUids', { uidsTo: uids, uidFrom: uid, type: type }, next);
		},
	], function (err, data) {
		if (err) {
			return winston.error(err.stack);
		}

		post.ip = undefined;

		data.uidsTo.forEach(function (toUid) {
			post.categoryWatchState = categoryWatchStates[toUid];
			post.topic.isFollowing = topicFollowState[toUid];
			websockets.in('uid_' + toUid).emit('event:new_post', result);
			if (result.topic && type === 'newTopic') {
				websockets.in('uid_' + toUid).emit('event:new_topic', result.topic);
			}
		});
	});
};

function getWatchStates(uids, tid, cid, callback) {
	async.parallel({
		topicFollowed: function (next) {
			db.isSetMembers('tid:' + tid + ':followers', uids, next);
		},
		topicIgnored: function (next) {
			db.isSetMembers('tid:' + tid + ':ignorers', uids, next);
		},
		categoryWatchStates: function (next) {
			categories.getUidsWatchStates(cid, uids, next);
		},
	}, callback);
}

function filterTidCidIgnorers(uids, watchStates) {
	return uids.filter(function (uid, index) {
		return watchStates.topicFollowed[index] ||
			(!watchStates.topicIgnored[index] && watchStates.categoryWatchStates[index] !== categories.watchStates.ignoring);
	});
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
			if (!results.canRead || results.isIgnoring[0] || !postData.uid || fromuid === postData.uid) {
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
			if (fromuid === results.topicData.uid) {
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
		if (notification && ownerUid) {
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
			return [1, 5, 10, 25].includes(votes) || (votes >= 50 && votes % 50 === 0);
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
