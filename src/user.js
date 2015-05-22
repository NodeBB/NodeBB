'use strict';

var	async = require('async'),
	nconf = require('nconf'),
	gravatar = require('gravatar'),

	plugins = require('./plugins'),
	db = require('./database'),
	meta = require('./meta'),
	topics = require('./topics'),
	groups = require('./groups'),
	Password = require('./password'),
	utils = require('../public/src/utils');

(function(User) {

	User.email = require('./user/email');
	User.notifications = require('./user/notifications');
	User.reset = require('./user/reset');
	User.digest = require('./user/digest');

	require('./user/auth')(User);
	require('./user/create')(User);
	require('./user/posts')(User);
	require('./user/follow')(User);
	require('./user/profile')(User);
	require('./user/admin')(User);
	require('./user/delete')(User);
	require('./user/settings')(User);
	require('./user/search')(User);
	require('./user/jobs')(User);
	require('./user/picture')(User);

	User.getUserField = function(uid, field, callback) {
		User.getUserFields(uid, [field], function(err, user) {
			callback(err, user ? user[field] : null);
		});
	};

	User.getUserFields = function(uid, fields, callback) {
		User.getMultipleUserFields([uid], fields, function(err, users) {
			callback(err, users ? users[0] : null);
		});
	};

	User.getMultipleUserFields = function(uids, fields, callback) {
		var fieldsToRemove = [];
		function addField(field) {
			if (fields.indexOf(field) === -1) {
				fields.push(field);
				fieldsToRemove.push(field);
			}
		}

		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var keys = uids.map(function(uid) {
			return 'user:' + uid;
		});

		if (fields.indexOf('uid') === -1) {
			fields.push('uid');
		}

		if (fields.indexOf('picture') !== -1) {
			addField('email');
			addField('gravatarpicture');
			addField('uploadedpicture');
		}

		db.getObjectsFields(keys, fields, function(err, users) {
			if (err) {
				return callback(err);
			}

			modifyUserData(users, fieldsToRemove, callback);
		});
	};

	User.getUserData = function(uid, callback) {
		User.getUsersData([uid], function(err, users) {
			callback(err, users ? users[0] : null);
		});
	};

	User.getUsersData = function(uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var keys = uids.map(function(uid) {
			return 'user:' + uid;
		});

		db.getObjects(keys, function(err, users) {
			if (err) {
				return callback(err);
			}

			modifyUserData(users, [], callback);
		});
	};

	function modifyUserData(users, fieldsToRemove, callback) {
		users.forEach(function(user) {
			if (!user) {
				return;
			}

			if (user.password) {
				user.password = undefined;
			}

			if (!parseInt(user.uid, 10)) {
				user.uid = 0;
				user.username = '[[global:guest]]';
				user.userslug = '';
				user.picture = User.createGravatarURLFromEmail('');
			}

			if (user.picture) {
				if (user.picture === user.uploadedpicture) {
					user.picture = user.uploadedpicture = user.picture.startsWith('http') ? user.picture : nconf.get('relative_path') + user.picture;
				} else {
					user.picture = User.createGravatarURLFromEmail(user.email);
				}
			}

			for(var i=0; i<fieldsToRemove.length; ++i) {
				user[fieldsToRemove[i]] = undefined;
			}
		});

		plugins.fireHook('filter:users.get', users, callback);
	}

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

	User.setUserField = function(uid, field, value, callback) {
		callback = callback || function() {};
		db.setObjectField('user:' + uid, field, value, function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:user.set', {uid: uid, field: field, value: value, type: 'set'});
			callback();
		});
	};

	User.setUserFields = function(uid, data, callback) {
		callback = callback || function() {};
		db.setObject('user:' + uid, data, function(err) {
			if (err) {
				return callback(err);
			}
			for (var field in data) {
				if (data.hasOwnProperty(field)) {
					plugins.fireHook('action:user.set', {uid: uid, field: field, value: data[field], type: 'set'});
				}
			}
			callback();
		});
	};

	User.incrementUserFieldBy = function(uid, field, value, callback) {
		callback = callback || function() {};
		db.incrObjectFieldBy('user:' + uid, field, value, function(err, value) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:user.set', {uid: uid, field: field, value: value, type: 'increment'});

			callback(null, value);
		});
	};

	User.decrementUserFieldBy = function(uid, field, value, callback) {
		callback = callback || function() {};
		db.incrObjectFieldBy('user:' + uid, field, -value, function(err, value) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:user.set', {uid: uid, field: field, value: value, type: 'decrement'});

			callback(null, value);
		});
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
		var fields = ['uid', 'username', 'userslug', 'picture', 'status', 'banned', 'joindate', 'postcount', 'reputation', 'email:confirmed'];
		plugins.fireHook('filter:users.addFields', {fields: fields}, function(err, data) {
			if (err) {
				return callback(err);
			}
			data.fields = data.fields.filter(function(field, index, array) {
				return array.indexOf(field) === index;
			});
			async.parallel({
				userData: function(next) {
					User.getMultipleUserFields(uids, data.fields, next);
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

	User.createGravatarURLFromEmail = function(email) {
		var customGravatarDefaultImage = meta.config.customGravatarDefaultImage;
		if (customGravatarDefaultImage && customGravatarDefaultImage.indexOf('http') === -1) {
			customGravatarDefaultImage = nconf.get('url') + meta.config.customGravatarDefaultImage;
		}

		var options = {
			size: parseInt(meta.config.profileImageDimension, 10) || 128,
			default: customGravatarDefaultImage || meta.config.defaultGravatarImage || 'identicon',
			rating: 'pg'
		};

		if (!email) {
			email = '';
		}

		return gravatar.url(email, options, true);
	};

	User.hashPassword = function(password, callback) {
		if (!password) {
			return callback(null, password);
		}

		Password.hash(nconf.get('bcrypt_rounds') || 12, password, callback);
	};

	User.addTopicIdToUser = function(uid, tid, timestamp, callback) {
		async.parallel([
			async.apply(db.sortedSetAdd, 'uid:' + uid + ':topics', timestamp, tid),
			async.apply(User.incrementUserFieldBy, uid, 'topiccount', 1)
		], callback);
	};

	User.exists = function(userslug, callback) {
		User.getUidByUserslug(userslug, function(err, exists) {
			callback(err, !! exists);
		});
	};

	User.getUidByUsername = function(username, callback) {
		if (!username) {
			return callback();
		}
		db.sortedSetScore('username:uid', username, callback);
	};

	User.getUidsByUsernames = function(usernames, callback) {
		db.sortedSetScores('username:uid', usernames, callback);
	};

	User.getUidByUserslug = function(userslug, callback) {
		if (!userslug) {
			return callback();
		}
		db.sortedSetScore('userslug:uid', userslug, callback);
	};

	User.getUsernamesByUids = function(uids, callback) {
		User.getMultipleUserFields(uids, ['username'], function(err, users) {
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
		function filterIsModerator(err, isModerator) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('filter:user.isModerator', {uid: uid, cid:cid, isModerator: isModerator}, function(err, data) {
				if (Array.isArray(uid) && !Array.isArray(data.isModerator) || Array.isArray(cid) && !Array.isArray(data.isModerator)) {
					return callback(new Error('filter:user.isModerator - i/o mismatch'));
				}

				callback(err, data.isModerator);
			});
		}

		if (Array.isArray(cid)) {
			if (!parseInt(uid, 10)) {
				return filterIsModerator(null, cid.map(function() {return false;}));
			}
			var uniqueCids = cid.filter(function(cid, index, array) {
				return array.indexOf(cid) === index;
			});

			var groupNames = uniqueCids.map(function(cid) {
					return 'cid:' + cid + ':privileges:mods';	// At some point we should *probably* change this to "moderate" as well
				}),
				groupListNames = uniqueCids.map(function(cid) {
					return 'cid:' + cid + ':privileges:groups:moderate';
				});

			async.parallel({
				user: async.apply(groups.isMemberOfGroups, uid, groupNames),
				group: async.apply(groups.isMemberOfGroupsList, uid, groupListNames)
			}, function(err, checks) {
				if (err) {
					return callback(err);
				}

				var isMembers = checks.user.map(function(isMember, idx) {
						return isMember || checks.group[idx];
					}),
					map = {};

				uniqueCids.forEach(function(cid, index) {
					map[cid] = isMembers[index];
				});

				filterIsModerator(null, cid.map(function(cid) {
					return map[cid];
				}));
			});
		} else {
			if (Array.isArray(uid)) {
				async.parallel([
					async.apply(groups.isMembers, uid, 'cid:' + cid + ':privileges:mods'),
					async.apply(groups.isMembersOfGroupList, uid, 'cid:' + cid + ':privileges:groups:moderate')
				], function(err, checks) {
					var isModerator = checks[0].map(function(isMember, idx) {
							return isMember || checks[1][idx];
						});
					filterIsModerator(null, isModerator);
				});
			} else {
				async.parallel([
					async.apply(groups.isMember, uid, 'cid:' + cid + ':privileges:mods'),
					async.apply(groups.isMemberOfGroupList, uid, 'cid:' + cid + ':privileges:groups:moderate')
				], function(err, checks) {
					var isModerator = checks[0] || checks[1];
					filterIsModerator(null, isModerator);
				});
			}
		}
	};

	User.isAdministrator = function(uid, callback) {
		if (Array.isArray(uid)) {
			groups.isMembers(uid, 'administrators', callback);
		} else {
			groups.isMember(uid, 'administrators', callback);
		}
	};

	User.getIgnoredCategories = function(uid, callback) {
		db.getSortedSetRange('uid:' + uid + ':ignored:cids', 0, -1, callback);
	};

	User.getWatchedCategories = function(uid, callback) {
		async.parallel({
			ignored: function(next) {
				User.getIgnoredCategories(uid, next);
			},
			all: function(next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var watched = results.all.filter(function(cid) {
				return cid && results.ignored.indexOf(cid) === -1;
			});
			callback(null, watched);
		});
	};

	User.ignoreCategory = function(uid, cid, callback) {
		if (!uid) {
			return callback();
		}
		db.sortedSetAdd('uid:' + uid + ':ignored:cids', Date.now(), cid, callback);
	};

	User.watchCategory = function(uid, cid, callback) {
		if (!uid) {
			return callback();
		}
		db.sortedSetRemove('uid:' + uid + ':ignored:cids', cid, callback);
	};


}(exports));
