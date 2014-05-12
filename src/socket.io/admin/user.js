"use strict";


var groups = require('../../groups'),
	user = require('../../user'),
	events = require('../../events'),
	websockets = require('../index'),
	async = require('async'),
	User = {};


User.makeAdmins = function(socket, uids, callback) {
	toggleAdmin(uids, true, callback);
};

User.removeAdmins = function(socket, uids, callback) {
	toggleAdmin(uids, false, callback);
};

function toggleAdmin(uids, isAdmin, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, function(uid, next) {
		groups[isAdmin ? 'join' : 'leave']('administrators', uid, next);
	}, callback);
}

User.createUser = function(socket, userData, callback) {
	if (!userData) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	user.create(userData, callback);
};

User.banUsers = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, User.banUser, callback);
};

User.banUser = function(uid, callback) {
	user.isAdministrator(uid, function(err, isAdmin) {
		if (err || isAdmin) {
			return callback(err || new Error('[[error:cant-ban-other-admins]]'));
		}

		user.ban(uid, function(err) {
			if (err) {
				return callback(err);
			}

			var sockets = websockets.getUserSockets(uid);

			for(var i=0; i<sockets.length; ++i) {
				sockets[i].emit('event:banned');
			}

			websockets.logoutUser(uid);
			callback();
		});
	});
};

User.unbanUsers = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.each(uids, user.unban, callback);
};

User.deleteUsers = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, function(uid, next) {
		user.delete(uid, function(err) {
			if (err) {
				return next(err);
			}

			events.logAdminUserDelete(socket.uid, uid);

			websockets.logoutUser(uid);
			next();
		});
	}, callback);
};

User.search = function(socket, username, callback) {
	user.search(username, function(err, data) {
		function isAdmin(userData, next) {
			user.isAdministrator(userData.uid, function(err, isAdmin) {
				if(err) {
					return next(err);
				}

				userData.administrator = isAdmin?'1':'0';
				next();
			});
		}

		if (err) {
			return callback(err);
		}

		async.each(data.users, isAdmin, function(err) {
			callback(err, data);
		});
	});
};

module.exports = User;