var	Groups = require('../groups'),

	SocketGroups = {};

SocketGroups.getMemberships = function(socket, data, callback) {
	if (data && data.uid) {
		Groups.getMemberships(data.uid, callback);
	}
};

module.exports = SocketGroups;