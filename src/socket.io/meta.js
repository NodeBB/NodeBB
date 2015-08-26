'use strict';

var	nconf = require('nconf'),
	gravatar = require('gravatar'),
	winston = require('winston'),
	validator = require('validator'),

	db = require('../database'),
	meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	logger = require('../logger'),
	plugins = require('../plugins'),
	emitter = require('../emitter'),
	rooms = require('./rooms'),

	websockets = require('./'),

	SocketMeta = {
		rooms: {}
	};

SocketMeta.reconnected = function(socket, data, callback) {
	if (socket.uid) {
		topics.pushUnreadCount(socket.uid);
		user.notifications.pushCount(socket.uid);
	}
};

emitter.on('nodebb:ready', function() {
	websockets.server.sockets.emit('event:nodebb.ready', {
		general: meta.config['cache-buster'],
		css: meta.css.hash,
		js: meta.js.hash
	});
});


/* Rooms */

SocketMeta.rooms.enter = function(socket, data, callback) {
	if (!socket.uid) {
		return callback();
	}

	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.enter) {
		data.enter = data.enter.toString();
	}

	if (data.enter && data.enter.startsWith('uid_') && data.enter !== 'uid_' + socket.uid) {
		return callback(new Error('[[error:not-allowed]]'));
	}

	if (socket.currentRoom) {
		rooms.leave(socket, socket.currentRoom);
		if (socket.currentRoom.indexOf('topic') !== -1) {
			websockets.in(socket.currentRoom).emit('event:user_leave', socket.uid);
		}
		socket.currentRoom = '';
	}

	if (data.enter) {
		rooms.enter(socket, data.enter);
		socket.currentRoom = data.enter;
		if (data.enter.indexOf('topic') !== -1) {
			data.uid = socket.uid;
			data.picture = validator.escape(data.picture);
			data.username = validator.escape(data.username);
			data.userslug = validator.escape(data.userslug);

			websockets.in(data.enter).emit('event:user_enter', data);
		}
	}
	callback();
};

SocketMeta.rooms.getAll = function(socket, data, callback) {
	var roomClients = rooms.roomClients();
	var socketData = {
			onlineGuestCount: websockets.getOnlineAnonCount(),
			onlineRegisteredCount: websockets.getOnlineUserCount(),
			socketCount: websockets.getSocketCount(),
			users: {
				categories: roomClients.categories ? roomClients.categories.length : 0,
				recent: roomClients.recent_topics ? roomClients.recent_topics.length : 0,
				unread: roomClients.unread_topics ? roomClients.unread_topics.length: 0,
				popular: roomClients.popular_topics ? roomClients.popular_topics.length: 0,
				topics: 0,
				category: 0
			},
			topics: {}
		};

	var scores = {},
		topTenTopics = [],
		tid;

	for (var room in roomClients) {
		if (roomClients.hasOwnProperty(room)) {
			tid = room.match(/^topic_(\d+)/);
			if (tid) {
				var length = roomClients[room].length;
				socketData.users.topics += length;

				if (scores[length]) {
					scores[length].push(tid[1]);
				} else {
					scores[length] = [tid[1]];
				}
			} else if (room.match(/^category/)) {
				socketData.users.category += roomClients[room].length;
			}
		}
	}

	var scoreKeys = Object.keys(scores),
		mostActive = scoreKeys.sort();

	while(topTenTopics.length < 10 && mostActive.length > 0) {
		topTenTopics = topTenTopics.concat(scores[mostActive.pop()]);
	}

	topTenTopics = topTenTopics.slice(0, 10);

	topics.getTopicsFields(topTenTopics, ['title'], function(err, titles) {
		if (err) {
			return callback(err);
		}
		topTenTopics.forEach(function(tid, id) {
			socketData.topics[tid] = {
				value: Array.isArray(roomClients['topic_' + tid]) ? roomClients['topic_' + tid].length : 0,
				title: validator.escape(titles[id].title)
			};
		});

		callback(null, socketData);
	});

};

/* Exports */

module.exports = SocketMeta;
