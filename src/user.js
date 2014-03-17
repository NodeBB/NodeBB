'use strict';

var bcrypt = require('bcryptjs'),
	async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),
	gravatar = require('gravatar'),
	validator = require('validator'),
	S = require('string'),

	utils = require('./../public/src/utils'),
	plugins = require('./plugins'),
	db = require('./database'),
	meta = require('./meta'),
	groups = require('./groups'),
	topics = require('./topics'),
	events = require('./events'),
	emitter = require('./emitter'),
	Emailer = require('./emailer');

(function(User) {

	User.email = require('./user/email');
	User.notifications = require('./user/notifications');
	User.reset = require('./user/reset');

	require('./user/follow')(User);
	require('./user/profile')(User);
	require('./user/admin')(User);
	require('./user/delete')(User);
	require('./user/settings')(User);
	require('./user/search')(User);

	User.create = function(userData, callback) {
		userData = userData || {};
		userData.userslug = utils.slugify(userData.username);

		userData.username = userData.username.trim();
		if (userData.email !== undefined) {
			userData.email = userData.email.trim();
			userData.email = validator.escape(userData.email);
		}

		async.parallel([
			function(next) {
				if (userData.email) {
					next(!utils.isEmailValid(userData.email) ? new Error('Invalid Email!') : null);
				} else {
					next();
				}
			},
			function(next) {
				next((!utils.isUserNameValid(userData.username) || !userData.userslug) ? new Error('Invalid Username!') : null);
			},
			function(next) {
				if (userData.password) {
					next(!utils.isPasswordValid(userData.password) ? new Error('Invalid Password!') : null);
				} else {
					next();
				}
			},
			function(next) {
				User.exists(userData.userslug, function(err, exists) {
					if (err) {
						return next(err);
					}
					next(exists ? new Error('Username taken!') : null);
				});
			},
			function(next) {
				if (userData.email) {
					User.email.available(userData.email, function(err, available) {
						if (err) {
							return next(err);
						}
						next(!available ? new Error('Email taken!') : null);
					});
				} else {
					next();
				}
			},
			function(next) {
				plugins.fireHook('filter:user.create', userData, function(err, filteredUserData){
					next(err, utils.merge(userData, filteredUserData));
				});
			}
		], function(err, results) {
			if (err) {
				return callback(err);
			}
			userData = results[results.length - 1];

			db.incrObjectField('global', 'nextUid', function(err, uid) {
				if(err) {
					return callback(err);
				}

				var gravatar = User.createGravatarURLFromEmail(userData.email);
				var timestamp = Date.now();
				var password = userData.password;

				userData = {
					'uid': uid,
					'username': userData.username,
					'userslug': userData.userslug,
					'fullname': '',
					'location': '',
					'birthday': '',
					'website': '',
					'email': userData.email || '',
					'signature': '',
					'joindate': timestamp,
					'picture': gravatar,
					'gravatarpicture': gravatar,
					'uploadedpicture': '',
					'profileviews': 0,
					'reputation': 0,
					'postcount': 0,
					'lastposttime': 0,
					'banned': 0,
					'status': 'online'
				};

				db.setObject('user:' + uid, userData, function(err) {

					if(err) {
						return callback(err);
					}
					db.setObjectField('username:uid', userData.username, uid);
					db.setObjectField('userslug:uid', userData.userslug, uid);

					if (userData.email !== undefined) {
						db.setObjectField('email:uid', userData.email, uid);
						if (parseInt(uid, 10) !== 1) {
							User.email.verify(uid, userData.email);
						}
					}

					plugins.fireHook('action:user.create', userData);
					db.incrObjectField('global', 'userCount');

					db.sortedSetAdd('users:joindate', timestamp, uid);
					db.sortedSetAdd('users:postcount', 0, uid);
					db.sortedSetAdd('users:reputation', 0, uid);

					groups.joinByGroupName('registered-users', uid);

					if (password) {
						User.hashPassword(password, function(err, hash) {
							if(err) {
								return callback(err);
							}

							User.setUserField(uid, 'password', hash);
							callback(null, uid);
						});
					} else {
						callback(null, uid);
					}
				});
			});
		});
	};

	User.getUserField = function(uid, field, callback) {
		db.getObjectField('user:' + uid, field, callback);
	};

	User.getUserFields = function(uid, fields, callback) {
		db.getObjectFields('user:' + uid, fields, callback);
	};

	User.getMultipleUserFields = function(uids, fields, callback) {

		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var keys = uids.map(function(uid) {
			return 'user:' + uid;
		});

		db.getObjectsFields(keys, fields, callback);
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

			users.forEach(function(user) {
				if (user) {
					if (user.password) {
						user.password = null;
						user.hasPassword = true;
					} else {
						user.hasPassword = false;
					}

					if (user.picture === user.uploadedpicture) {
						user.picture = nconf.get('relative_path') + user.picture;
					}
				}
			});

			callback(null, users);
		});
	};

	User.updateLastOnlineTime = function(uid, callback) {
		User.getUserField(uid, 'status', function(err, status) {
			function cb(err) {
				if(typeof callback === 'function') {
					callback(err);
				}
			}

			if(err || status === 'offline') {
				return cb(err);
			}

			User.setUserField(uid, 'lastonline', Date.now(), cb);
		});
	};

	User.isReadyToPost = function(uid, callback) {
		User.getUserField(uid, 'lastposttime', function(err, lastposttime) {
			if(err) {
				return callback(err);
			}

			if(!lastposttime) {
				lastposttime = 0;
			}

			if (Date.now() - parseInt(lastposttime, 10) < parseInt(meta.config.postDelay, 10) * 1000) {
				return callback(new Error('too-many-posts'));
			}
			callback();
		});
	};

	User.setUserField = function(uid, field, value, callback) {
		db.setObjectField('user:' + uid, field, value, callback);
	};

	User.setUserFields = function(uid, data, callback) {
		db.setObject('user:' + uid, data, callback);
	};

	User.incrementUserFieldBy = function(uid, field, value, callback) {
		db.incrObjectFieldBy('user:' + uid, field, value, callback);
	};

	User.decrementUserFieldBy = function(uid, field, value, callback) {
		db.incrObjectFieldBy('user:' + uid, field, -value, callback);
	};

	User.getUsers = function(set, start, stop, callback) {
		function loadUserInfo(user, callback) {
			if (!user) {
				return callback(null, user);
			}

			async.waterfall([
				function(next) {
					User.isAdministrator(user.uid, next);
				},
				function(isAdmin, next) {
					user.status = !user.status ? 'online' : user.status;
					user.administrator = isAdmin ? '1':'0';
					if (set === 'users:online') {
						return callback(null, user);
					}
					db.sortedSetScore('users:online', user.uid, next);
				},
				function(score, next) {
					if (!score) {
						user.status = 'offline';
					}
					next(null, user);
				}
			], callback);
		}

		async.waterfall([
			function(next) {
				db.getSortedSetRevRange(set, start, stop, next);
			},
			function(uids, next) {
				User.getUsersData(uids, next);
			},
			function(users, next) {
				async.map(users, loadUserInfo, next);
			}
		], callback);
	};

	User.createGravatarURLFromEmail = function(email) {
		var options = {
			size: '128',
			default: 'identicon',
			rating: 'pg'
		};

		if (!email) {
			email = '';
			options.forcedefault = 'y';
		}

		return gravatar.url(email, options, true);
	};

	User.hashPassword = function(password, callback) {
		if (!password) {
			return callback(password);
		}

		bcrypt.genSalt(nconf.get('bcrypt_rounds'), function(err, salt) {
			if (err) {
				return callback(err);
			}
			bcrypt.hash(password, salt, callback);
		});
	};

	User.onNewPostMade = function(postData) {
		User.addPostIdToUser(postData.uid, postData.pid, postData.timestamp);

		User.incrementUserFieldBy(postData.uid, 'postcount', 1, function(err, newpostcount) {
			db.sortedSetAdd('users:postcount', newpostcount, postData.uid);
		});

		User.setUserField(postData.uid, 'lastposttime', postData.timestamp);
	};

	emitter.on('event:newpost', User.onNewPostMade);

	User.addPostIdToUser = function(uid, pid, timestamp) {
		db.sortedSetAdd('uid:' + uid + ':posts', timestamp, pid);
	};

	User.addTopicIdToUser = function(uid, tid, timestamp) {
		db.sortedSetAdd('uid:' + uid + ':topics', timestamp, tid);
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
		db.getObjectField('email:uid', email, callback);
	};

	User.getUsernameByEmail = function(email, callback) {
		db.getObjectField('email:uid', email, function(err, uid) {
			if (err) {
				return callback(err);
			}
			User.getUserField(uid, 'username', callback);
		});
	};

	User.isModerator = function(uid, cid, callback) {
		groups.isMemberByGroupName(uid, 'cid:' + cid + ':privileges:mods', callback);
	};

	User.isAdministrator = function(uid, callback) {
		groups.isMemberByGroupName(uid, 'administrators', callback);
	};

	User.isOnline = function(uid, callback) {
		User.getUserField(uid, 'status', function(err, status) {
			if(err) {
				return callback(err);
			}

			var online = require('./socket.io').isUserOnline(uid);

			status = online ? (status || 'online') : 'offline';

			if(status === 'offline') {
				online = false;
			}

			callback(null, {
				online: online,
				uid: uid,
				timestamp: Date.now(),
				status: status
			});
		});
	};


}(exports));
