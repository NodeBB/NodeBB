"use strict";

var	groups = require('../groups'),

	SocketGroups = {};

SocketGroups.join = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.join(data.groupName, socket.uid, callback);
};

SocketGroups.leave = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.leave(data.groupName, socket.uid, callback);
};

module.exports = SocketGroups;
