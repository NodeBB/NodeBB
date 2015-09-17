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

Groups.join = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.join(data.groupName, data.uid, callback);
};

Groups.leave = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (socket.uid === parseInt(data.uid, 10) && data.groupName === 'administrators') {
		return callback(new Error('[[error:cant-remove-self-as-admin]]'));
	}

	groups.leave(data.groupName, data.uid, callback);
};

Groups.update = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.update(data.groupName, data.values, callback);
};

module.exports = Groups;