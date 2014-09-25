'use strict';

var	async = require('async'),
	nconf = require('nconf'),
	gravatar = require('gravatar'),

	plugins = require('./plugins'),
	db = require('./database'),
	meta = require('./meta'),
	groups = require('./groups'),
	Password = require('./password');

(function(User) {

	User.email = require('./user/email');
	User.notifications = require('./user/notifications');
	User.reset = require('./user/reset');

	require('./user/auth')(User);
	require('./user/create')(User);
	require('./user/follow')(User);
	require('./user/profile')(User);
	require('./user/admin')(User);
	require('./user/delete')(User);
	require('./user/settings')(User);
	require('./user/search')(User);
	require('./user/jobs')(User);

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

		addField('uid');

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
				user.password = null;
			}

			if (!parseInt(user.uid, 10)) {
				user.uid = 0;
				user.username = '[[global:guest]]';
				user.userslug = '';
			}

			if (user.picture) {
				if (user.picture === user.uploadedpicture) {
					user.picture = user.picture.indexOf('http') === -1 ? nconf.get('relative_path') + user.picture : user.picture;
				} else {
					user.picture = User.createGravatarURLFromEmail(user.email);
				}
			} else {
				user.picture = User.createGravatarURLFromEmail('');
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
			if(err || userData.status === 'offline' || Date.now() - parseInt(userData.lastonline, 10) < 300000) {
				return callback(err);
			}

			User.setUserField(uid, 'lastonline', Date.now(), callback);
		});
	};

	User.isReadyToPost = function(uid, callback) {
		if (parseInt(uid, 10) === 0) {
			return callback();
		}

		async.parallel({
			userData: function(next) {
				User.getUserFields(uid, ['banned', 'lastposttime', 'joindate', 'email', 'email:confirmed'], next);
			},
			exists: function(next) {
				db.exists('user:' + uid, next);
			},
			isAdmin: function(next) {
				User.isAdministrator(uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!results.exists) {
				return callback(new Error('[[error:no-user]]'));
			}

			if (results.isAdmin) {
				return callback();
			}

			var userData = results.userData;

			if (parseInt(userData.banned, 10) === 1) {
				return callback(new Error('[[error:user-banned]]'));
			}

			if (userData.email && parseInt(meta.config.requireEmailConfirmation, 10) === 1 && parseInt(userData['email:confirmed'], 10) !== 1) {
				return callback(new Error('[[error:email-not-confirmed]]'));
			}
			var now = Date.now();
			if (now - parseInt(userData.joindate, 10) < parseInt(meta.config.initialPostDelay, 10) * 1000) {
				return callback(new Error('[[error:user-too-new, ' + meta.config.initialPostDelay + ']]'));
			}

			var lastposttime = userData.lastposttime || 0;

			if (now - parseInt(lastposttime, 10) < parseInt(meta.config.postDelay, 10) * 1000) {
				return callback(new Error('[[error:too-many-posts, ' + meta.config.postDelay + ']]'));
			}
			callback();
		});
	};

	User.setUserField = function(uid, field, value, callback) {
		plugins.fireHook('action:user.set', field, value, 'set');
		db.setObjectField('user:' + uid, field, value, callback);
	};

	User.setUserFields = function(uid, data, callback) {
		for (var field in data) {
			if (data.hasOwnProperty(field)) {
				plugins.fireHook('action:user.set', field, data[field], 'set');
			}
		}

		db.setObject('user:' + uid, data, callback);
	};

	User.incrementUserFieldBy = function(uid, field, value, callback) {
		db.incrObjectFieldBy('user:' + uid, field, value, function(err, value) {
			plugins.fireHook('action:user.set', field, value, 'increment');

			if (typeof callback === 'function') {
				callback(err, value);
			}
		});
	};

	User.decrementUserFieldBy = function(uid, field, value, callback) {
		db.incrObjectFieldBy('user:' + uid, field, -value, function(err, value) {
			plugins.fireHook('action:user.set', field, value, 'decrement');

			if (typeof callback === 'function') {
				callback(err, value);
			}
		});
	};

	User.getUsersFromSet = function(set, start, stop, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange(set, start, stop, next);
			},
			function(uids, next) {
				User.getUsers(uids, next);
			}
		], callback);
	};

	User.getUsers = function(uids, callback) {
		async.parallel({
			userData: function(next) {
				User.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture', 'status', 'banned', 'postcount', 'reputation'], next);
			},
			isAdmin: function(next) {
				User.isAdministrator(uids, next);
			},
			isOnline: function(next) {
				db.isSortedSetMembers('users:online', uids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			results.userData.forEach(function(user, index) {
				if (!user) {
					return;
				}
				user.status = !user.status ? 'online' : user.status;
				user.status = !results.isOnline[index] ? 'offline' : user.status;
				user.administrator = results.isAdmin[index];
				user.banned = parseInt(user.banned, 10) === 1;
			});

			callback(err, results.userData);
		});
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

		Password.hash(nconf.get('bcrypt_rounds'), password, callback);
	};

	User.onNewPostMade = function(postData, callback) {
		async.parallel([
			function(next) {
				User.addPostIdToUser(postData.uid, postData.pid, postData.timestamp, next);
			},
			function(next) {
				User.incrementUserPostCountBy(postData.uid, 1, next);
			},
			function(next) {
				User.setUserField(postData.uid, 'lastposttime', postData.timestamp, next);
			}
		], callback);
	};

	User.incrementUserPostCountBy = function(uid, value, callback) {
		callback = callback || function() {};
		User.incrementUserFieldBy(uid, 'postcount', value, function(err, newpostcount) {
			if (err) {
				return callback(err);
			}
			db.sortedSetAdd('users:postcount', newpostcount, uid, callback);
		});
	};

	User.addPostIdToUser = function(uid, pid, timestamp, callback) {
		db.sortedSetAdd('uid:' + uid + ':posts', timestamp, pid, callback);
	};

	User.addTopicIdToUser = function(uid, tid, timestamp, callback) {
		db.sortedSetAdd('uid:' + uid + ':topics', timestamp, tid, callback);
	};

	User.getPostIds = function(uid, start, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':posts', start, stop, function(err, pids) {
			callback(err, Array.isArray(pids) ? pids : []);
		});
	};

	User.exists = function(userslug, callback) {
		User.getUidByUserslug(userslug, function(err, exists) {
			callback(err, !! exists);
		});
	};

	User.count = function(callback) {
		db.getObjectField('global', 'userCount', function(err, count) {
			callback(err, count ? count : 0);
		});
	};

	User.getUidByUsername = function(username, callback) {
		db.getObjectField('username:uid', username, callback);
	};

	User.getUidByUserslug = function(userslug, callback) {
		db.getObjectField('userslug:uid', userslug, callback);
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
		db.getObjectField('email:uid', email.toLowerCase(), callback);
	};

	User.getUsernameByEmail = function(email, callback) {
		db.getObjectField('email:uid', email.toLowerCase(), function(err, uid) {
			if (err) {
				return callback(err);
			}
			User.getUserField(uid, 'username', callback);
		});
	};

	User.isModerator = function(uid, cid, callback) {
		if (Array.isArray(cid)) {
			var groupNames = cid.map(function(cid) {
				return 'cid:' + cid + ':privileges:mods';
			});
			groups.isMemberOfGroups(uid, groupNames, callback);
		} else {
			if (Array.isArray(uid)) {
				groups.isMembers(uid, 'cid:' + cid + ':privileges:mods', callback);
			} else {
				groups.isMember(uid, 'cid:' + cid + ':privileges:mods', callback);
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
