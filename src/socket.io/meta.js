var	meta = require('../meta'),
	user = require('../user'),

	gravatar = require('gravatar'),

	SocketMeta = {};

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
		sessionData.server.sockets.in('admin').emit('api:get_all_rooms', sessionData.server.sockets.manager.rooms);
	}
};

/* Exports */

module.exports = SocketMeta;