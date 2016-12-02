"use strict";

var async = require('async');
var validator = require('validator');

var db = require('../../database');
var groups = require('../../groups');
var user = require('../../user');
var events = require('../../events');
var meta = require('../../meta');

var User = {};

User.makeAdmins = function (socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.getUsersFields(uids, ['banned'], function (err, userData) {
		if (err) {
			return callback(err);
		}

		for(var i = 0; i < userData.length; i++) {
			if (userData[i] && parseInt(userData[i].banned, 10) === 1) {
				return callback(new Error('[[error:cant-make-banned-users-admin]]'));
			}
		}

		async.each(uids, function (uid, next) {
			groups.join('administrators', uid, next);
		}, callback);
	});
};

User.removeAdmins = function (socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.eachSeries(uids, function (uid, next) {
		groups.getMemberCount('administrators', function (err, count) {
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

User.resetFlags = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.resetFlags(uids, callback);
};

User.validateEmail = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	uids = uids.filter(function (uid) {
		return parseInt(uid, 10);
	});

	async.each(uids, function (uid, next) {
		user.setUserField(uid, 'email:confirmed', 1, next);
	}, function (err) {
		if (err) {
			return callback(err);
		}
		db.sortedSetRemove('users:notvalidated', uids, callback);
	});
};

User.sendValidationEmail = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (parseInt(meta.config.requireEmailConfirmation, 10) !== 1) {
		return callback(new Error('[[error:email-confirmations-are-disabled]]'));
	}

	user.getUsersFields(uids, ['uid', 'email'], function (err, usersData) {
		if (err) {
			return callback(err);
		}

		async.eachLimit(usersData, 50, function (userData, next) {
			if (userData.email && userData.uid) {
				user.email.sendValidationEmail(userData.uid, userData.email, next);
			} else {
				next();
			}
		}, callback);
	});
};

User.sendPasswordResetEmail = function (socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	uids = uids.filter(function (uid) {
		return parseInt(uid, 10);
	});

	async.each(uids, function (uid, next) {
		user.getUserFields(uid, ['email', 'username'], function (err, userData) {
			if (err) {
				return next(err);
			}
			if (!userData.email) {
				return next(new Error('[[error:user-doesnt-have-email, ' + userData.username + ']]'));
			}
			user.reset.send(userData.email, next);
		});
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

	async.each(uids, function (uid, next) {
		async.waterfall([
			function (next) {
				user.isAdministrator(uid, next);
			},
			function (isAdmin, next) {
				if (isAdmin) {
					return next(new Error('[[error:cant-delete-other-admins]]'));
				}

				method(uid, next);
			},
			function (next) {
				events.log({
					type: 'user-delete',
					uid: socket.uid,
					targetUid: uid,
					ip: socket.ip
				});
				next();
			}
		], next);
	}, callback);
}

User.search = function (socket, data, callback) {
	var searchData;
	async.waterfall([
		function (next) {
			user.search({query: data.query, searchBy: data.searchBy, uid: socket.uid}, next);
		},
		function (_searchData, next) {
			searchData = _searchData;
			if (!searchData.users.length) {
				return callback(null, searchData);
			}

			var uids = searchData.users.map(function (user) {
				return user && user.uid;
			});

			user.getUsersFields(uids, ['email', 'flags', 'lastonline', 'joindate'], next);
		},
		function (userInfo, next) {
			searchData.users.forEach(function (user, index) {
				if (user && userInfo[index]) {
					user.email = validator.escape(String(userInfo[index].email || ''));
					user.flags = userInfo[index].flags || 0;
					user.lastonlineISO = userInfo[index].lastonlineISO;
					user.joindateISO = userInfo[index].joindateISO;
				}
			});
			next(null, searchData);
		}
	], callback);
};

User.deleteInvitation = function (socket, data, callback) {
	user.deleteInvitation(data.invitedBy, data.email, callback);
};

User.acceptRegistration = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.acceptRegistration(data.username, next);
		},
		function (uid, next) {
			events.log({
				type: 'registration-approved',
				uid: socket.uid,
				ip: socket.ip,
				targetUid: uid
			});
			next(null, uid);
		}
	], callback);
};

User.rejectRegistration = function (socket, data, callback) {
	async.waterfall([
		function (next) {
			user.rejectRegistration(data.username, next);
		},
		function (next) {
			events.log({
				type: 'registration-rejected',
				uid: socket.uid,
				ip: socket.ip,
				username: data.username,
			});
			next();
		}
	], callback);
};

User.restartJobs = function (socket, data, callback) {
	user.startJobs(callback);
};

module.exports = User;
