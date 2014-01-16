var	user = require('../user'),

	SocketNotifs = {};

SocketNotifs.get = function(socket, data, callback) {
	user.notifications.get(socket.uid, function(notifs) {
		callback(notifs);
	});
};

SocketNotifs.getCount = function(socket, callback) {
	user.notifications.getUnreadCount(socket.uid, function(err, count) {
		callback(err ? err.message : null, count);
	});
};

module.exports = SocketNotifs;