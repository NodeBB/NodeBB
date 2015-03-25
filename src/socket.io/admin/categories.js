"use strict";

var async = require('async'),

	groups = require('../../groups'),
	user = require('../../user'),
	categories = require('../../categories'),
	privileges = require('../../privileges'),
	Categories = {};

Categories.create = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.create(data, callback);
};

Categories.purge = function(socket, cid, callback) {
	categories.purge(cid, callback);
};

Categories.update = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	categories.update(data, callback);
};

Categories.search = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var	username = data.username,
		cid = data.cid;

	user.search({query: username, uid: socket.uid}, function(err, data) {
		if (err) {
			return callback(err);
		}

		async.map(data.users, function(userObj, next) {
			privileges.categories.userPrivileges(cid, userObj.uid, function(err, privileges) {
				if(err) {
					return next(err);
				}

				userObj.privileges = privileges;
				next(null, userObj);
			});
		}, callback);
	});
};

Categories.setPrivilege = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	groups[data.set ? 'join' : 'leave']('cid:' + data.cid + ':privileges:' + data.privilege, data.member, callback);
};

Categories.getPrivilegeSettings = function(socket, cid, callback) {
	privileges.categories.list(cid, callback);
};

module.exports = Categories;