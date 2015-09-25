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
	websockets.server.emit('event:nodebb.ready', {
		'cache-buster': meta.config['cache-buster']
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

	var	topTenTopics = [],
		tid;

	for (var room in roomClients) {
		if (roomClients.hasOwnProperty(room)) {
			tid = room.match(/^topic_(\d+)/);
			if (tid) {
				var length = roomClients[room].length;
				socketData.users.topics += length;

				topTenTopics.push({tid: tid[1], count: length});
			} else if (room.match(/^category/)) {
				socketData.users.category += roomClients[room].length;
			}
		}
	}

	topTenTopics = topTenTopics.sort(function(a, b) {
		return b.count - a.count;
	}).slice(0, 10);

	var topTenTids = topTenTopics.map(function(topic) {
		return topic.tid;
	});

	topics.getTopicsFields(topTenTids, ['title'], function(err, titles) {
		if (err) {
			return callback(err);
		}
		topTenTopics.forEach(function(topic, index) {
			socketData.topics[topic.tid] = {
				value: topic.count || 0,
				title: validator.escape(titles[index].title)
			};
		});

		callback(null, socketData);
	});

};

module.exports = SocketMeta;
