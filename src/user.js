'use strict';

var	async = require('async'),
	nconf = require('nconf'),
	gravatar = require('gravatar'),
	validator = require('validator'),

	plugins = require('./plugins'),
	db = require('./database'),
	meta = require('./meta'),
	topics = require('./topics'),
	groups = require('./groups'),
	Password = require('./password'),
	privileges = require('./privileges'),
	utils = require('../public/src/utils');

(function(User) {

	User.email = require('./user/email');
	User.notifications = require('./user/notifications');
	User.reset = require('./user/reset');
	User.digest = require('./user/digest');

	require('./user/data')(User);
	require('./user/auth')(User);
	require('./user/create')(User);
	require('./user/posts')(User);
	require('./user/categories')(User);
	require('./user/follow')(User);
	require('./user/profile')(User);
	require('./user/admin')(User);
	require('./user/delete')(User);
	require('./user/settings')(User);
	require('./user/search')(User);
	require('./user/jobs')(User);
	require('./user/picture')(User);
	require('./user/approval')(User);
	require('./user/invite')(User);
	require('./user/icon')(User);

	User.updateLastOnlineTime = function(uid, callback) {
		callback = callback || function() {};
		User.getUserFields(uid, ['status', 'lastonline'], function(err, userData) {
			var now = Date.now();
			if (err || userData.status === 'offline' || now - parseInt(userData.lastonline, 10) < 300000) {
				return callback(err);
			}

			User.setUserField(uid, 'lastonline', now, callback);
		});
	};

	User.updateOnlineUsers = function(uid, callback) {
		callback = callback || function() {};

		var now = Date.now();
		async.waterfall([
			function(next) {
				db.sortedSetScore('users:online', uid, next);
			},
			function(userOnlineTime, next) {
				if (now - parseInt(userOnlineTime, 10) < 300000) {
					return callback();
				}
				db.sortedSetAdd('users:online', now, uid, next);
			},
			function(next) {
				topics.pushUnreadCount(uid);
				plugins.fireHook('action:user.online', {uid: uid, timestamp: now});
				next();
			}
		], callback);
	};

	User.getUidsFromSet = function(set, start, stop, callback) {
		if (set === 'users:online') {
			var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
			var now = Date.now();
			db.getSortedSetRevRangeByScore(set, start, count, now, now - 300000, callback);
		} else {
			db.getSortedSetRevRange(set, start, stop, callback);
		}
	};

	User.getUsersFromSet = function(set, uid, start, stop, callback) {
		async.waterfall([
			function(next) {
				User.getUidsFromSet(set, start, stop, next);
			},
			function(uids, next) {
				User.getUsers(uids, uid, next);
			}
		], callback);
	};

	User.getUsers = function(uids, uid, callback) {
		var fields = ['uid', 'username', 'userslug', 'picture', 'icon:bgColor', 'icon:text', 'status', 'banned', 'joindate', 'postcount', 'reputation', 'email:confirmed'];
		plugins.fireHook('filter:users.addFields', {fields: fields}, function(err, data) {
			if (err) {
				return callback(err);
			}
			data.fields = data.fields.filter(function(field, index, array) {
				return array.indexOf(field) === index;
			});
			async.parallel({
				userData: function(next) {
					User.getUsersFields(uids, data.fields, next);
				},
				isAdmin: function(next) {
					User.isAdministrator(uids, next);
				},
				isOnline: function(next) {
					require('./socket.io').isUsersOnline(uids, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.userData.forEach(function(user, index) {
					if (!user) {
						return;
					}
					user.status = User.getStatus(user.status, results.isOnline[index]);
					user.joindateISO = utils.toISOString(user.joindate);
					user.administrator = results.isAdmin[index];
					user.banned = parseInt(user.banned, 10) === 1;
					user['email:confirmed'] = parseInt(user['email:confirmed'], 10) === 1;
				});

				plugins.fireHook('filter:userlist.get', {users: results.userData, uid: uid}, function(err, data) {
					if (err) {
						return callback(err);
					}
					callback(null, data.users);
				});
			});
		});
	};

	User.getStatus = function(status, isOnline) {
		return isOnline ? (status || 'online') : 'offline';
	};

	User.hashPassword = function(password, callback) {
		if (!password) {
			return callback(null, password);
		}

		Password.hash(nconf.get('bcrypt_rounds') || 12, password, callback);
	};

	User.exists = function(userslug, callback) {
		User.getUidByUserslug(userslug, function(err, exists) {
			callback(err, !! exists);
		});
	};

	User.getUidByUsername = function(username, callback) {
		if (!username) {
			return callback(null, 0);
		}
		db.sortedSetScore('username:uid', username, callback);
	};

	User.getUidsByUsernames = function(usernames, callback) {
		db.sortedSetScores('username:uid', usernames, callback);
	};

	User.getUidByUserslug = function(userslug, callback) {
		if (!userslug) {
			return callback(null, 0);
		}
		db.sortedSetScore('userslug:uid', userslug, callback);
	};

	User.getUsernamesByUids = function(uids, callback) {
		User.getUsersFields(uids, ['username'], function(err, users) {
			if (err) {
				return callback(err);
			}

			users = users.map(function(user) {
				return user.username;
			});

			callback(null, users);
		});
	};

	User.getUsernameByUserslug = function(slug, callback) {
		async.waterfall([
			function(next) {
				User.getUidByUserslug(slug, next);
			},
			function(uid, next) {
				User.getUserField(uid, 'username', next);
			}
		], callback);
	};

	User.getUidByEmail = function(email, callback) {
		db.sortedSetScore('email:uid', email.toLowerCase(), callback);
	};

	User.getUsernameByEmail = function(email, callback) {
		db.sortedSetScore('email:uid', email.toLowerCase(), function(err, uid) {
			if (err) {
				return callback(err);
			}
			User.getUserField(uid, 'username', callback);
		});
	};

	User.isModerator = function(uid, cid, callback) {
		privileges.users.isModerator(uid, cid, callback);
	};

	User.isAdministrator = function(uid, callback) {
		privileges.users.isAdministrator(uid, callback);
	};


}(exports));

