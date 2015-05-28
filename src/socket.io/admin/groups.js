"use strict";

var groups = require('../../groups'),
	Groups = {};

Groups.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.create({
		name: data.name,
		description: data.description,
		ownerUid: socket.uid
	}, callback);
};

Groups.get = function(socket, groupName, callback) {
	groups.get(groupName, {
		escape: false,
		uid: socket.uid
	}, callback);
};

Groups.join = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.join(data.groupName, data.uid, callback);
};

Groups.leave = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.leave(data.groupName, data.uid, callback);
};

// Possibly remove this and call SocketGroups.update instead
Groups.update = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.update(data.groupName, data.values, function(err) {
		callback(err ? err.message : null);
	});
};

module.exports = Groups;