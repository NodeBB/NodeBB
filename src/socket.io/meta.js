var	meta = require('../meta'),
	user = require('../user'),
	topics = require('../topics'),
	logger = require('../logger'),
	plugins = require('../plugins'),

	nconf = require('nconf'),
	gravatar = require('gravatar'),
	winston = require('winston'),
	server = require('./'),

	SocketMeta = {};

SocketMeta.reconnected = function(socket) {
	var	uid = socket.uid,
		sessionID = socket.id;

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

SocketMeta.buildTitle = function(socket, text, callback) {
	meta.title.build(text, function(err, title) {
		callback(err, title);
	});
};

SocketMeta.updateHeader = function(socket, data, callback) {
	if (socket.uid) {
		user.getUserFields(socket.uid, data.fields, function(err, fields) {
			if(err) {
				return callback(err);
			}

			if (fields) {
				fields.uid = socket.uid;
				callback(null, fields);
			} else {
				callback([]);
			}
		});
	} else {
		callback(null, {
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

SocketMeta.getUsageStats = function(socket, data, callback) {
	module.parent.exports.emitTopicPostStats(callback);
};

/* Rooms */

SocketMeta.rooms = {};

SocketMeta.rooms.enter = function(socket, data) {
	if (data.leave !== null) {
		socket.leave(data.leave);
	}

	socket.join(data.enter);
	server.rooms[data.enter] = server.rooms[data.enter] || {};

	if (socket.uid) {
		server.rooms[data.enter][socket.id] = socket.uid;

		if (data.leave && server.rooms[data.leave] && server.rooms[data.leave][socket.id] && data.enter !== data.leave) {
			delete server.rooms[data.leave][socket.id];
		}
	}

	if (data.leave) {
		module.parent.exports.updateRoomBrowsingText(data.leave);
	}

	module.parent.exports.updateRoomBrowsingText(data.enter);

	if (data.enter != 'admin') {
		server.in('admin').emit('event:meta.rooms.update', null, server.rooms);
	}
};

SocketMeta.rooms.getAll = function(socket, data, callback) {
	callback(null, server.rooms);
};

/* Exports */

module.exports = SocketMeta;