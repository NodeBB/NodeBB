"use strict";


var async = require('async'),
	db = require('../../database'),
	groups = require('../../groups'),
	user = require('../../user'),
	events = require('../../events'),
	meta = require('../../meta'),
	websockets = require('../index'),
	User = {};


User.makeAdmins = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.getUsersFields(uids, ['banned'], function(err, userData) {
		if (err) {
			return callback(err);
		}

		for(var i=0; i<userData.length; i++) {
			if (userData[i] && parseInt(userData[i].banned, 10) === 1) {
				return callback(new Error('[[error:cant-make-banned-users-admin]]'));
			}
		}

		async.each(uids, function(uid, next) {
			groups.join('administrators', uid, next);
		}, callback);
	});
};

User.removeAdmins = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
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

User.resetFlags = function(socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.resetFlags(uids, callback);
};

User.validateEmail = function(socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	uids = uids.filter(function(uid) {
		return parseInt(uid, 10);
	});

	async.each(uids, function(uid, next) {
		user.setUserField(uid, 'email:confirmed', 1, next);
	}, callback);
};

User.sendValidationEmail = function(socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (parseInt(meta.config.requireEmailConfirmation, 10) !== 1) {
		return callback(new Error('[[error:email-confirmations-are-disabled]]'));
	}

	user.getUsersFields(uids, ['uid', 'email'], function(err, usersData) {
		if (err) {
			return callback(err);
		}

		async.eachLimit(usersData, 50, function(userData, next) {
			if (userData.email && userData.uid) {
				user.email.sendValidationEmail(userData.uid, userData.email, next);
			} else {
				next();
			}
		}, callback);
	});
};

User.sendPasswordResetEmail = function(socket, uids, callback) {
	if (!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	uids = uids.filter(function(uid) {
		return parseInt(uid, 10);
	});

	async.each(uids, function(uid, next) {
		user.getUserFields(uid, ['email', 'username'], function(err, userData) {
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

User.deleteUsers = function(socket, uids, callback) {
	if(!Array.isArray(uids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(uids, function(uid, next) {
		user.isAdministrator(uid, function(err, isAdmin) {
			if (err || isAdmin) {
				return callback(err || new Error('[[error:cant-delete-other-admins]]'));
			}

			user.delete(uid, function(err) {
				if (err) {
					return next(err);
				}

				events.log({
					type: 'user-delete',
					uid: socket.uid,
					targetUid: uid,
					ip: socket.ip
				});

				websockets.logoutUser(uid);
				next();
			});
		});
	}, callback);
};

User.search = function(socket, data, callback) {
	user.search({query: data.query, searchBy: data.searchBy, uid: socket.uid}, function(err, searchData) {
		if (err) {
			return callback(err);
		}
		if (!searchData.users.length) {
			return callback(null, searchData);
		}

		var userData = searchData.users;
		var uids = userData.map(function(user) {
			return user && user.uid;
		});

		async.parallel({
			users: function(next) {
				user.getUsersFields(uids, ['email'], next);
			},
			flagCounts: function(next) {
				var sets = uids.map(function(uid) {
					return 'uid:' + uid + ':flagged_by';
				});
				db.setsCount(sets, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			userData.forEach(function(user, index) {
				if (user) {
					user.email = (results.users[index] && results.users[index].email) || '';
					user.flags = results.flagCounts[index] || 0;
				}
			});

			callback(null, searchData);
		});
	});
};

User.acceptRegistration = function(socket, data, callback) {
	user.acceptRegistration(data.username, callback);
};

User.rejectRegistration = function(socket, data, callback) {
	user.rejectRegistration(data.username, callback);
};


module.exports = User;