'use strict';

var	async = require('async');
var _ = require('underscore');

var groups = require('./groups');
var plugins = require('./plugins');
var db = require('./database');
var topics = require('./topics');
var privileges = require('./privileges');
var meta = require('./meta');

(function (User) {

	User.email = require('./user/email');
	User.notifications = require('./user/notifications');
	User.reset = require('./user/reset');
	User.digest = require('./user/digest');

	require('./user/data')(User);
	require('./user/auth')(User);
	require('./user/bans')(User);
	require('./user/create')(User);
	require('./user/posts')(User);
	require('./user/topics')(User);
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
	require('./user/password')(User);
	require('./user/info')(User);

	User.updateLastOnlineTime = function (uid, callback) {
		callback = callback || function () {};
		db.getObjectFields('user:' + uid, ['status', 'lastonline'], function (err, userData) {
			var now = Date.now();
			if (err || userData.status === 'offline' || now - parseInt(userData.lastonline, 10) < 300000) {
				return callback(err);
			}
			User.setUserField(uid, 'lastonline', now, callback);
		});
	};

	User.updateOnlineUsers = function (uid, callback) {
		callback = callback || function () {};

		var now = Date.now();
		async.waterfall([
			function (next) {
				db.sortedSetScore('users:online', uid, next);
			},
			function (userOnlineTime, next) {
				if (now - parseInt(userOnlineTime, 10) < 300000) {
					return callback();
				}
				db.sortedSetAdd('users:online', now, uid, next);
			},
			function (next) {
				topics.pushUnreadCount(uid);
				plugins.fireHook('action:user.online', {uid: uid, timestamp: now});
				next();
			}
		], callback);
	};

	User.getUidsFromSet = function (set, start, stop, callback) {
		if (set === 'users:online') {
			var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
			var now = Date.now();
			db.getSortedSetRevRangeByScore(set, start, count, '+inf', now - 300000, callback);
		} else {
			db.getSortedSetRevRange(set, start, stop, callback);
		}
	};

	User.getUsersFromSet = function (set, uid, start, stop, callback) {
		async.waterfall([
			function (next) {
				User.getUidsFromSet(set, start, stop, next);
			},
			function (uids, next) {
				User.getUsers(uids, uid, next);
			}
		], callback);
	};

	User.getUsersWithFields = function (uids, fields, uid, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:users.addFields', {fields: fields}, next);
			},
			function (data, next) {
				data.fields = data.fields.filter(function (field, index, array) {
					return array.indexOf(field) === index;
				});

				async.parallel({
					userData: function (next) {
						User.getUsersFields(uids, data.fields, next);
					},
					isAdmin: function (next) {
						User.isAdministrator(uids, next);
					}
				}, next);
			},
			function (results, next) {
				results.userData.forEach(function (user, index) {
					if (user) {
						user.status = User.getStatus(user);
						user.administrator = results.isAdmin[index];
						user.banned = parseInt(user.banned, 10) === 1;
						user.banned_until = parseInt(user['banned:expire'], 10) || 0;
						user.banned_until_readable = user.banned_until ? new Date(user.banned_until).toString() : 'Not Banned';
						user['email:confirmed'] = parseInt(user['email:confirmed'], 10) === 1;
					}
				});
				plugins.fireHook('filter:userlist.get', {users: results.userData, uid: uid}, next);
			},
			function (data, next) {
				next(null, data.users);
			}
		], callback);
	};

	User.getUsers = function (uids, uid, callback) {
		var fields = ['uid', 'username', 'userslug', 'picture', 'status', 'flags',
			'banned', 'banned:expire', 'joindate', 'postcount', 'reputation', 'email:confirmed', 'lastonline'];

		User.getUsersWithFields(uids, fields, uid, callback);
	};

	User.getStatus = function (userData) {
		var isOnline = (Date.now() - parseInt(userData.lastonline, 10)) < 300000;
		return isOnline ? (userData.status || 'online') : 'offline';
	};

	User.isOnline = function (uid, callback) {
		if (Array.isArray(uid)) {
			db.sortedSetScores('users:online', uid, function (err, lastonline) {
				if (err) {
					return callback(err);
				}
				var now = Date.now();
				var isOnline = uid.map(function (uid, index) {
					return now - lastonline[index] < 300000;
				});
				callback(null, isOnline);
			});
		} else {
			db.sortedSetScore('users:online', uid, function (err, lastonline) {
				if (err) {
					return callback(err);
				}
				var isOnline = Date.now() - parseInt(lastonline, 10) < 300000;
				callback(null, isOnline);
			});
		}

	};

	User.exists = function (uid, callback) {
		db.isSortedSetMember('users:joindate', uid, callback);
	};

	User.existsBySlug = function (userslug, callback) {
		User.getUidByUserslug(userslug, function (err, exists) {
			callback(err, !! exists);
		});
	};

	User.getUidByUsername = function (username, callback) {
		if (!username) {
			return callback(null, 0);
		}
		db.sortedSetScore('username:uid', username, callback);
	};

	User.getUidsByUsernames = function (usernames, callback) {
		db.sortedSetScores('username:uid', usernames, callback);
	};

	User.getUidByUserslug = function (userslug, callback) {
		if (!userslug) {
			return callback(null, 0);
		}
		db.sortedSetScore('userslug:uid', userslug, callback);
	};

	User.getUsernamesByUids = function (uids, callback) {
		User.getUsersFields(uids, ['username'], function (err, users) {
			if (err) {
				return callback(err);
			}

			users = users.map(function (user) {
				return user.username;
			});

			callback(null, users);
		});
	};

	User.getUsernameByUserslug = function (slug, callback) {
		async.waterfall([
			function (next) {
				User.getUidByUserslug(slug, next);
			},
			function (uid, next) {
				User.getUserField(uid, 'username', next);
			}
		], callback);
	};

	User.getUidByEmail = function (email, callback) {
		db.sortedSetScore('email:uid', email.toLowerCase(), callback);
	};

	User.getUidsByEmails = function (emails, callback) {
		emails = emails.map(function (email) {
			return email && email.toLowerCase();
		});
		db.sortedSetScores('email:uid', emails, callback);
	};

	User.getUsernameByEmail = function (email, callback) {
		db.sortedSetScore('email:uid', email.toLowerCase(), function (err, uid) {
			if (err) {
				return callback(err);
			}
			User.getUserField(uid, 'username', callback);
		});
	};

	User.isModerator = function (uid, cid, callback) {
		privileges.users.isModerator(uid, cid, callback);
	};

	User.isModeratorOfAnyCategory = function (uid, callback) {
		User.getModeratedCids(uid, function (err, cids) {
			callback(err, Array.isArray(cids) ? !!cids.length : false);
		});
	};

	User.isAdministrator = function (uid, callback) {
		privileges.users.isAdministrator(uid, callback);
	};

	User.isGlobalModerator = function (uid, callback) {
		privileges.users.isGlobalModerator(uid, callback);
	};

	User.isAdminOrGlobalMod = function (uid, callback) {
		async.parallel({
			isAdmin: async.apply(User.isAdministrator, uid),
			isGlobalMod: async.apply(User.isGlobalModerator, uid)
		}, function (err, results) {
			callback(err, results ? (results.isAdmin || results.isGlobalMod) : false);
		});
	};

	User.isAdminOrSelf = function (callerUid, uid, callback) {
		if (parseInt(callerUid, 10) === parseInt(uid, 10)) {
			return callback();
		}
		User.isAdministrator(callerUid, function (err, isAdmin) {
			if (err || !isAdmin) {
				return callback(err || new Error('[[error:no-privileges]]'));
			}
			callback();
		});
	};

	User.getAdminsandGlobalMods = function (callback) {
		async.parallel({
			admins: async.apply(groups.getMembers, 'administrators', 0, -1),
			mods: async.apply(groups.getMembers, 'Global Moderators', 0, -1)
		}, function (err, results) {
			if (err) {
				return callback(err);
			}
			var uids = results.admins.concat(results.mods).filter(function (uid, index, array) {
				return uid && array.indexOf(uid) === index;
			});
			User.getUsersData(uids, callback);
		});
	};

	User.getAdminsandGlobalModsandModerators = function (callback) {
		async.parallel([
			async.apply(groups.getMembers, 'administrators', 0, -1),
			async.apply(groups.getMembers, 'Global Moderators', 0, -1),
			async.apply(User.getModeratorUids)
		], function (err, results) {
			if (err) {
				return callback(err);
			}

			User.getUsersData(_.union.apply(_, results), callback);
		});
	};

	User.getModeratorUids = function (callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
			function (cids, next) {
				var groupNames = cids.map(function (cid) {
					return 'cid:' + cid + ':privileges:mods';
				});

				groups.getMembersOfGroups(groupNames, function (err, memberSets) {
					if (err) {
						return next(err);
					}

					next(null, _.union.apply(_, memberSets));
				});
			}
		], callback);
	};

	User.getModeratedCids = function (uid, callback) {
		var cids;
		async.waterfall([
			function (next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			},
			function (_cids, next) {
				cids = _cids;
				User.isModerator(uid, cids, next);
			},
			function (isMods, next) {
				cids = cids.filter(function (cid, index) {
					return cid && isMods[index];
				});
				next(null, cids);
			}
		], callback);
	};

	User.addInterstitials = function (callback) {
		plugins.registerHook('core', {
			hook: 'filter:register.interstitial',
			method: function (data, callback) {
				if (meta.config.termsOfUse && !data.userData.acceptTos) {
					data.interstitials.push({
						template: 'partials/acceptTos',
						data: {
							termsOfUse: meta.config.termsOfUse
						},
						callback: function (userData, formData, next) {
							if (formData['agree-terms'] === 'on') {
								userData.acceptTos = true;
							}

							next(userData.acceptTos ? null : new Error('[[register:terms_of_use_error]]'));
						}
					});
				}

				callback(null, data);
			}
		});

		callback();
	};


}(exports));
