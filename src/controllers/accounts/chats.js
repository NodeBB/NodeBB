'use strict';

var async = require('async');

var messaging = require('../../messaging');
var meta = require('../../meta');
var user = require('../../user');
var helpers = require('../helpers');

var chatsController = {};

chatsController.get = function (req, res, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1) {
		return callback();
	}
	var uid;
	var username;
	var recentChats;

	async.waterfall([
		function (next) {
			async.parallel({
				uid: async.apply(user.getUidByUserslug, req.params.userslug),
				username: async.apply(user.getUsernameByUserslug, req.params.userslug),
			}, next);
		},
		function (results, next) {
			uid = results.uid;
			username = results.username;
			if (!uid) {
				return callback();
			}
			messaging.getRecentChats(req.uid, uid, 0, 19, next);
		},
		function (_recentChats, next) {
			recentChats = _recentChats;
			if (!recentChats) {
				return callback();
			}
			if (!req.params.roomid) {
				return res.render('chats', {
					rooms: recentChats.rooms,
					uid: uid,
					userslug: req.params.userslug,
					nextStart: recentChats.nextStart,
					allowed: true,
					title: '[[pages:chats]]',
				});
			}
			messaging.isUserInRoom(req.uid, req.params.roomid, next);
		},
		function (inRoom, next) {
			if (!inRoom) {
				return callback();
			}
			async.parallel({
				users: async.apply(messaging.getUsersInRoom, req.params.roomid, 0, -1),
				canReply: async.apply(messaging.canReply, req.params.roomid, req.uid),
				room: async.apply(messaging.getRoomData, req.params.roomid),
				messages: async.apply(messaging.getMessages, {
					callerUid: req.uid,
					uid: uid,
					roomId: req.params.roomid,
					isNew: false,
				}),
			}, next);
		},
	], function (err, data) {
		if (err) {
			return callback(err);
		}
		var room = data.room;
		room.messages = data.messages;

		room.isOwner = parseInt(room.owner, 10) === parseInt(req.uid, 10);
		room.users = data.users.filter(function (user) {
			return user && parseInt(user.uid, 10) && parseInt(user.uid, 10) !== req.uid;
		});

		room.canReply = data.canReply;
		room.groupChat = room.hasOwnProperty('groupChat') ? room.groupChat : room.users.length > 2;
		room.rooms = recentChats.rooms;
		room.uid = uid;
		room.userslug = req.params.userslug;
		room.nextStart = recentChats.nextStart;
		room.usernames = messaging.generateUsernames(room.users, req.uid);
		room.title = room.roomName || room.usernames || '[[pages:chats]]';
		room.maximumUsersInChatRoom = parseInt(meta.config.maximumUsersInChatRoom, 10) || 0;
		room.maximumChatMessageLength = parseInt(meta.config.maximumChatMessageLength, 10) || 1000;
		room.showUserInput = !room.maximumUsersInChatRoom || room.maximumUsersInChatRoom > 2;

		res.render('chats', room);
	});
};

chatsController.redirectToChat = function (req, res, next) {
	var roomid = parseInt(req.params.roomid, 10);
	if (!req.uid) {
		return next();
	}
	user.getUserField(req.uid, 'userslug', function (err, userslug) {
		if (err || !userslug) {
			return next(err);
		}

		helpers.redirect(res, '/user/' + userslug + '/chats' + (roomid ? '/' + roomid : ''));
	});
};


module.exports = chatsController;
