'use strict';

var	meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	logger = require('../logger'),
	plugins = require('../plugins'),
	emitter = require('../emitter'),

	nconf = require('nconf'),
	gravatar = require('gravatar'),
	winston = require('winston'),
	validator = require('validator'),
	websockets = require('./'),

	SocketMeta = {
		rooms: {}
	};

SocketMeta.reconnected = function(socket, data, callback) {
	var	uid = socket.uid,
		sessionID = socket.id;

	if (uid) {
		topics.pushUnreadCount(uid);
		user.notifications.pushCount(uid);
	}

	if (process.env.NODE_ENV === 'development') {
		if (uid) {
			winston.info('[socket] uid ' + uid + ' (' + sessionID + ') has successfully reconnected.');
		} else {
			winston.info('[socket] An anonymous user (' + sessionID + ') has successfully reconnected.');
		}
	}
};

emitter.on('nodebb:ready', function() {
	websockets.server.sockets.emit('event:nodebb.ready', {
		general: meta.config['cache-buster'],
		css: meta.css.hash,
		js: meta.js.hash
	});
});

SocketMeta.buildTitle = function(socket, text, callback) {
	if (socket.uid) {
		user.getSettings(socket.uid, function(err, settings) {
			if (err) {
				return callback(err);
			}
			meta.title.build(text, settings.language, callback);
		});
	} else {
		meta.title.build(text, meta.config.defaultLang, callback);
	}
};

SocketMeta.getUsageStats = function(socket, data, callback) {
	module.parent.exports.emitTopicPostStats(callback);
};

/* Rooms */

SocketMeta.rooms.enter = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.leave) {
		socket.leave(data.leave);
		if (socket.uid && data.leave.indexOf('topic') !== -1) {
			websockets.in(data.leave).emit('event:user_leave', socket.uid);
		}
	}

	if (data.enter) {
		socket.join(data.enter);
		if (socket.uid && data.enter.indexOf('topic') !== -1) {
			data.uid = socket.uid;
			websockets.in(data.enter).emit('event:user_enter', data);
		}
	}
};

SocketMeta.rooms.getAll = function(socket, data, callback) {
	var rooms = websockets.server.sockets.manager.rooms,
		socketData = {
			onlineGuestCount: websockets.getOnlineAnonCount(),
			onlineRegisteredCount: websockets.getOnlineUserCount(),
			socketCount: websockets.getSocketCount(),
			users: {
				home: rooms['/home'] ? rooms['/home'].length : 0,
				topics: 0,
				category: 0
			},
			topics: {}
		};

	var scores = {},
		topTenTopics = [],
		tid;

	for (var room in rooms) {
		if (rooms.hasOwnProperty(room)) {
			if (tid = room.match(/^\/topic_(\d+)/)) {
				var length = rooms[room].length;
				socketData.users.topics += length;

				if (scores[length]) {
					scores[length].push(tid[1]);
				} else {
					scores[length] = [tid[1]];
				}
			} else if (room.match(/^\/category/)) {
				socketData.users.category += rooms[room].length
			}
		}
	}

	var scoreKeys = Object.keys(scores),
		mostActive = scoreKeys.sort();

	while(topTenTopics.length < 10 && mostActive.length > 0) {
		topTenTopics = topTenTopics.concat(scores[mostActive.pop()]);
	}

	topTenTopics = topTenTopics.slice(0,9);

	topics.getTopicsFields(topTenTopics, ['title'], function(err, titles) {
		topTenTopics.forEach(function(tid, id) {
			socketData.topics[tid] = {
				value: rooms['/topic_' + tid].length,
				title: validator.escape(titles[id].title)
			}
		});

		callback(null, socketData);
	});
};

/* Exports */

module.exports = SocketMeta;
