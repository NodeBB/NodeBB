var	meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	logger = require('../logger'),
	plugins = require('../plugins'),

	nconf = require('nconf'),
	gravatar = require('gravatar'),
	winston = require('winston'),

	SocketMeta = {};

SocketMeta.reconnected = function(sessionData) {
	var	uid = sessionData.uid,
		sessionID = sessionData.socket.id;

	if (uid) {
		topics.pushUnreadCount(uid);
		user.pushNotifCount(uid);
	}

	if (process.env.NODE_ENV === 'development') {
		if (uid) {
			winston.info('[socket] uid ' + uid + ' (' + sessionID + ') has successfully reconnected.');
		} else {
			winston.info('[socket] An anonymous user (' + sessionID + ') has successfully reconnected.');
		}
	}
};

SocketMeta.buildTitle = function(text, callback) {
	meta.title.build(text, function(err, title) {
		callback(title);
	});
};

SocketMeta.updateHeader = function(data, callback, sessionData) {
	if (sessionData.uid) {
		user.getUserFields(sessionData.uid, data.fields, function(err, fields) {
			if (!err && fields) {
				fields.uid = sessionData.uid;
				callback(fields);
			}
		});
	} else {
		callback({
			uid: 0,
			username: "Anonymous User",
			email: '',
			picture: gravatar.url('', {
				s: '24'
			}, nconf.get('https')),
			config: {
				allowGuestSearching: meta.config.allowGuestSearching
			}
		});
	}
};

SocketMeta.getUsageStats = function(callback) {
	module.parent.exports.emitTopicPostStats(callback);
};

/* Rooms */

SocketMeta.rooms = {};

SocketMeta.rooms.enter = function(data, sessionData) {
	if (data.leave !== null) {
		sessionData.socket.leave(data.leave);
	}

	sessionData.socket.join(data.enter);
	sessionData.rooms[data.enter] = sessionData.rooms[data.enter] || {};

	if (sessionData.uid) {
		sessionData.rooms[data.enter][sessionData.socket.id] = sessionData.uid;

		if (data.leave && sessionData.rooms[data.leave] && sessionData.rooms[data.leave][sessionData.socket.id] && data.enter !== data.leave) {
			delete sessionData.rooms[data.leave][sessionData.socket.id];
		}
	}

	if (data.leave) {
		module.parent.exports.updateRoomBrowsingText(data.leave);
	}

	module.parent.exports.updateRoomBrowsingText(data.enter);

	if (data.enter != 'admin') {
		sessionData.server.sockets.in('admin').emit('event:meta.rooms.update', sessionData.server.sockets.manager.rooms);
	}
};

SocketMeta.rooms.getAll = function(callback, sessionData) {
	callback(sessionData.server.sockets.manager.rooms);
};

/* Exports */

module.exports = SocketMeta;