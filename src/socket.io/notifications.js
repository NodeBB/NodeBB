var	user = require('../user'),

	SocketNotifs = {};

SocketNotifs.get = function(data, callback, sessionData) {
	user.notifications.get(sessionData.uid, function(notifs) {
		callback(notifs);
	});
};

SocketNotifs.getCount = function(callback, sessionData) {
	user.notifications.getUnreadCount(sessionData.uid, function(err, count) {
		callback(err ? err.message : null, count);
	});
};

module.exports = SocketNotifs;