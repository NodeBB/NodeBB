'use strict';

var async = require('async');
var winston = require('winston');

var db = require('../../database');
var groups = require('../../groups');
var user = require('../../user');
var events = require('../../events');
var meta = require('../../meta');
var plugins = require('../../plugins');

var User = module.exports;

User.makeAdmins = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.waterfall([
		function (next) {
			user.getUsersFields(uids, ['banned'], next);
		},
		function (userData, next) {
			for (var i = 0; i < userData.length; i += 1) {
				if (userData[i] && userData[i].banned) {
					return callback(new Error('[[error:cant-make-banned-users-admin]]'));
				}
			}

			async.each(uids, function (uid, next) {
				groups.join('administrators', uid, next);
			}, next);
		},
	], callback);
};

User.removeAdmins = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.eachSeries(uids, function (uid, next) {
		async.waterfall([
			function (next) {
				groups.getMemberCount('administrators', next);
			},
			function (count, next) {
				if (count === 1) {
					return next(new Error('[[error:cant-remove-last-admin]]'));
				}

				groups.leave('administrators', uid, next);
			},
		], next);
	}, callback);
};

User.createUser = function (socket, userData, callback) {
	if (!userData) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	user.create(userData, callback);
};

User.resetLockouts = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, user.auth.resetLockout, callback);
};

User.validateEmail = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	uids = uids.filter(uid => parseInt(uid, 10));

	async.waterfall([
		function (next) {
			async.each(uids, function (uid, next) {
				user.setUserField(uid, 'email:confirmed', 1, next);
			}, next);
		},
		function (next) {
			db.sortedSetRemove('users:notvalidated', uids, next);
		},
	], callback);
};

User.sendValidationEmail = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!meta.config.requireEmailConfirmation) {
		return callback(new Error('[[error:email-confirmations-are-disabled]]'));
	}

	async.eachLimit(uids, 50, function (uid, next) {
		user.email.sendValidationEmail(uid, next);
	}, callback);
};

User.sendPasswordResetEmail = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	uids = uids.filter(uid => parseInt(uid, 10));

	async.each(uids, function (uid, next) {
		async.waterfall([
			function (next) {
				user.getUserFields(uid, ['email', 'username'], next);
			},
			function (userData, next) {
				if (!userData.email) {
					return next(new Error('[[error:user-doesnt-have-email, ' + userData.username + ']]'));
				}
				user.reset.send(userData.email, next);
			},
		], next);
	}, callback);
};

User.deleteUsers = function (socket, uids, callback) {
	deleteUsers(socket, uids, function (uid, next) {
		user.deleteAccount(uid, next);
	}, callback);
};

User.deleteUsersAndContent = function (socket, uids, callback) {
	deleteUsers(socket, uids, function (uid, next) {
		user.delete(socket.uid, uid, next);
	}, callback);
};

function deleteUsers(socket, uids, method, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			groups.isMembers(uids, 'administrators', next);
		},
		function (isMembers, next) {
			if (isMembers.includes(true)) {
				return callback(new Error('[[error:cant-delete-other-admins]]'));
			}

			callback();

			async.each(uids, function (uid, next) {
				async.waterfall([
					function (next) {
						method(uid, next);
					},
					function (userData, next) {
						events.log({
							type: 'user-delete',
							uid: socket.uid,
							targetUid: uid,
							ip: socket.ip,
							username: userData.username,
							email: userData.email,
						}, next);
					},
					function (next) {
						plugins.fireHook('action:user.delete', {
							callerUid: socket.uid,
							uid: uid,
							ip: socket.ip,
						});
						next();
					},
				], next);
			}, next);
		},
	], function (err) {
		if (err) {
			winston.error(err);
		}
	});
}

User.search = function (socket, data, callback) {
	var searchData;
	async.waterfall([
		function (next) {
			user.search({
				query: data.query,
				searchBy: data.searchBy,
				uid: socket.uid,
			}, next);
		},
		function (_searchData, next) {
			searchData = _searchData;
			if (!searchData.users.length) {
				return callback(null, searchData);
			}

			var uids = searchData.users.map(user => user && user.uid);

			user.getUsersFields(uids, ['email', 'flags', 'lastonline', 'joindate'], next);
		},
		function (userInfo, next) {
			searchData.users.forEach(function (user, index) {
				if (user && userInfo[index]) {
					user.email = userInfo[index].email;
					user.flags = userInfo[index].flags || 0;
					user.lastonlineISO = userInfo[index].lastonlineISO;
					user.joindateISO = userInfo[index].joindateISO;
				}
			});
			next(null, searchData);
		},
	], callback);
};

User.restartJobs = function (socket, data, callback) {
	user.startJobs(callback);
};
