'use strict';

var async = require('async');

var messaging = require('../../messaging');
var meta = require('../../meta');
var helpers = require('../helpers');


var chatsController = {};

chatsController.get = function(req, res, callback) {
	if (parseInt(meta.config.disableChat, 10) === 1) {
		return callback();
	}

	messaging.getRecentChats(req.uid, 0, 19, function(err, recentChats) {
		if (err) {
			return callback(err);
		}

		if (!req.params.roomid) {
			return res.render('chats', {
				rooms: recentChats.rooms,
				nextStart: recentChats.nextStart,
				allowed: true,
				title: '[[pages:chats]]',
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:chats]]'}])
			});
		}

		async.waterfall([
			function (next) {
				messaging.isUserInRoom(req.uid, req.params.roomid, next);
			},
			function (inRoom, next) {
				if (!inRoom) {
					return callback();
				}

				async.parallel({
					users: async.apply(messaging.getUsersInRoom, req.params.roomid, 0, -1),
					messages: async.apply(messaging.getMessages, {
						uid: req.uid,
						roomId: req.params.roomid,
						since: 'recent',
						isNew: false
					}),
					allowed: async.apply(messaging.canMessageRoom, req.uid, req.params.roomid)
				}, next);
			}
		], function(err, data) {
			if (err) {
				return callback(err);
			}

			data.users = data.users.filter(function(user) {
				return user && parseInt(user.uid, 10) !== req.uid;
			});

			var usernames = data.users.map(function(user) {
				return user && user.username;
			}).join(', ');

			res.render('chats', {
				roomId: req.params.roomid,
				rooms: recentChats.rooms,
				nextStart: recentChats.nextStart,
				users: data.users,
				usernames: usernames,
				messages: data.messages,
				allowed: data.allowed,
				title: '[[pages:chat, ' + usernames + ']]',
				breadcrumbs: helpers.buildBreadcrumbs([{text: '[[pages:chats]]', url: '/chats'}, {text: usernames}])
			});
		});
	});
};

module.exports = chatsController;