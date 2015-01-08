"use strict";

var	groups = require('../groups'),
	meta = require('../meta'),

	SocketGroups = {};

SocketGroups.join = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (meta.config.allowPrivateGroups) {
		groups.isPrivate(data.groupName, function(err, isPrivate) {
			if (isPrivate) {
				groups.requestMembership(data.groupName, socket.uid, callback);
			} else {
				groups.join(data.groupName, socket.uid, callback);
			}
		});
	} else {
		groups.join(data.groupName, socket.uid, callback);
	}
};

SocketGroups.leave = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.leave(data.groupName, socket.uid, callback);
};

SocketGroups.grant = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.ownership.grant(data.toUid, data.groupName, callback);
	});
};

SocketGroups.rescind = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.ownership.isOwner(socket.uid, data.groupName, function(err, isOwner) {
		if (!isOwner) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		groups.ownership.rescind(data.toUid, data.groupName, callback);
	});
};

module.exports = SocketGroups;
