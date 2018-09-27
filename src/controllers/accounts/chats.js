'use strict';

var async = require('async');

var messaging = require('../../messaging');
var meta = require('../../meta');
var user = require('../../user');
var privileges = require('../../privileges');
var helpers = require('../helpers');

var chatsController = module.exports;

chatsController.get = function (req, res, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1) {
		return callback();
	}

	var uid;
	var recentChats;

	async.waterfall([
		function (next) {
			user.getUidByUserslug(req.params.userslug, next);
		},
		function (_uid, next) {
			uid = _uid;
			if (!uid) {
				return callback();
			}
			privileges.global.can('chat', req.uid, next);
		},
		function (canChat, next) {
			if (!canChat) {
				return next(new Error('[[error:no-privileges]]'));
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
			messaging.loadRoom(req.uid, { uid: uid, roomId: req.params.roomid }, next);
		},
		function (room) {
			if (!room) {
				return callback();
			}
			room.rooms = recentChats.rooms;
			room.nextStart = recentChats.nextStart;
			room.title = room.roomName || room.usernames || '[[pages:chats]]';
			room.uid = uid;
			room.userslug = req.params.userslug;
			res.render('chats', room);
		},
	], callback);
};

chatsController.redirectToChat = function (req, res, next) {
	var roomid = parseInt(req.params.roomid, 10);
	if (!req.loggedIn) {
		return next();
	}
	async.waterfall([
		function (next) {
			user.getUserField(req.uid, 'userslug', next);
		},
		function (userslug, next) {
			if (!userslug) {
				return next();
			}
			helpers.redirect(res, '/user/' + userslug + '/chats' + (roomid ? '/' + roomid : ''));
		},
	], next);
};
