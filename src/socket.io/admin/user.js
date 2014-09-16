"use strict";


var groups = require('../../groups'),
	user = require('../../user'),
	events = require('../../events'),
	websockets = require('../index'),
	async = require('async'),
	User = {};


User.makeAdmins = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, function(uid, next) {
		groups.join('administrators', uid, next);
	}, callback);
};

User.removeAdmins = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (uids.indexOf(socket.uid.toString()) !== -1) {
		return callback(new Error('[[error:cant-remove-self-as-admin]]'));
	}

	async.eachSeries(uids, function(uid, next) {
		groups.getMemberCount('administrators', function(err, count) {
			if (err) {
				return next(err);
			}

			if (count === 1) {
				return next(new Error('[[error:cant-remove-last-admin]]'));
			}

			groups.leave('administrators', uid, next);
		});
	}, callback);
};

User.createUser = function(socket, userData, callback) {
	if (!userData) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	user.create(userData, callback);
};

User.banUsers = function(socket, uids, callback) {
	toggleBan(uids, User.banUser, callback);
};

User.unbanUsers = function(socket, uids, callback) {
	toggleBan(uids, user.unban, callback);
};

function toggleBan(uids, method, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.each(uids, method, callback);
}

User.banUser = function(uid, callback) {
	user.isAdministrator(uid, function(err, isAdmin) {
		if (err || isAdmin) {
			return callback(err || new Error('[[error:cant-ban-other-admins]]'));
		}

		user.ban(uid, function(err) {
			if (err) {
				return callback(err);
			}

			websockets.in('uid_' + uid).emit('event:banned');

			websockets.logoutUser(uid);
			callback();
		});
	});
};

User.resetLockouts = function(socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, user.auth.resetLockout, callback);
};

User.deleteUsers = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, function(uid, next) {
		user.isAdministrator(uid, function(err, isAdmin) {
			if (err || isAdmin) {
				return callback(err || new Error('[[error:cant-ban-other-admins]]'));
			}

			user.delete(uid, function(err) {
				if (err) {
					return next(err);
				}

				events.logAdminUserDelete(socket.uid, uid);

				websockets.logoutUser(uid);
				next();
			});
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

				userData.administrator = isAdmin;
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