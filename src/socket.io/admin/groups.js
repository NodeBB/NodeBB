"use strict";

var groups = require('../../groups'),
	Groups = {};

Groups.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.create(data.name, data.description, function(err, groupObj) {
		callback(err, groupObj || undefined);
	});
};

Groups.delete = function(socket, groupName, callback) {
	groups.destroy(groupName, callback);
};

Groups.get = function(socket, groupName, callback) {
	groups.get(groupName, {
		expand: true
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

Groups.update = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups.update(data.groupName, data.values, function(err) {
		callback(err ? err.message : null);
	});
};

module.exports = Groups;