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
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (data.leave !== null) {
		socket.leave(data.leave);
	}

	socket.join(data.enter);

	if (data.leave && data.leave !== data.enter && data.leave.indexOf('topic') !== -1) {
		module.parent.exports.updateRoomBrowsingText(data.leave);
	}

	if (data.enter.indexOf('topic') !== -1) {
		module.parent.exports.updateRoomBrowsingText(data.enter);
	}
};

SocketMeta.rooms.getAll = function(socket, data, callback) {
	var userData = {
		onlineGuestCount: websockets.getOnlineAnonCount(),
		onlineRegisteredCount: websockets.getConnectedClients().length,
		socketCount: websockets.getSocketCount()
	};

	callback(null, userData);
};

/* Exports */

module.exports = SocketMeta;
