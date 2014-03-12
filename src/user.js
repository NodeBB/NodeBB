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
	Emailer = require('./emailer');

(function(User) {

	User.email = require('./useremail');
	User.notifications = require('./usernotifications');
	User.reset = require('./userreset');

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

	User.ban = function(uid, callback) {
		User.setUserField(uid, 'banned', 1, callback);
	};

	User.unban = function(uid, callback) {
		User.setUserField(uid, 'banned', 0, callback);
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
						// Append relative url
						user.picture = nconf.get('relative_path') + user.picture;
					}
				}
			});

			callback(null, users);
		});
	};

	User.getSettings = function(uid, callback) {
		function sendDefaultSettings() {
			callback(null, {
				showemail: false,
				usePagination: parseInt(meta.config.usePagination, 10) === 1,
				topicsPerPage: parseInt(meta.config.topicsPerPage, 10) || 20,
				postsPerPage: parseInt(meta.config.postsPerPage, 10) || 10
			});
		}

		if(!parseInt(uid, 10)) {
			return sendDefaultSettings();
		}

		db.getObject('user:' + uid + ':settings', function(err, settings) {
			if(err) {
				return callback(err);
			}

			if(!settings) {
				settings = {};
			}

			settings.showemail = settings.showemail ? parseInt(settings.showemail, 10) !== 0 : false;
			settings.usePagination = settings.usePagination ? parseInt(settings.usePagination, 10) === 1 : parseInt(meta.config.usePagination, 10) === 1;
			settings.topicsPerPage = settings.topicsPerPage ? parseInt(settings.topicsPerPage, 10) : parseInt(meta.config.topicsPerPage, 10) || 20;
			settings.postsPerPage = settings.postsPerPage ? parseInt(settings.postsPerPage, 10) : parseInt(meta.config.postsPerPage, 10) || 10;

			callback(null, settings);
		});
	};

	User.saveSettings = function(uid, data, callback) {

		if(!data.topicsPerPage || !data.postsPerPage || parseInt(data.topicsPerPage, 10) <= 0 || parseInt(data.postsPerPage, 10) <= 0) {
			return callback(new Error('Invalid pagination value!'));
		}

		db.setObject('user:' + uid + ':settings', {
			showemail: data.showemail,
			usePagination: data.usePagination,
			topicsPerPage: data.topicsPerPage,
			postsPerPage: data.postsPerPage
		}, callback);
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

	User.updateProfile = function(uid, data, callback) {
		var fields = ['username', 'email', 'fullname', 'website', 'location', 'birthday', 'signature'];
		var returnData = {
			success: false
		};

		function isSignatureValid(next) {
			if (data.signature !== undefined && data.signature.length > meta.config.maximumSignatureLength) {
				next(new Error('Signature can\'t be longer than ' + meta.config.maximumSignatureLength + ' characters!'), false);
			} else {
				next(null, true);
			}
		}

		function isEmailAvailable(next) {
			if (!data.email) {
				return next(null, true);
			}

			User.getUserField(uid, 'email', function(err, email) {
				if(email === data.email) {
					return next(null, true);
				}

				User.email.available(data.email, function(err, available) {
					if (err) {
						return next(err, null);
					}

					if (!available) {
						next(new Error('Email not available!'), false);
					} else {
						next(null, true);
					}
				});
			});
		}

		function isUsernameAvailable(next) {
			User.getUserFields(uid, ['username', 'userslug'], function(err, userData) {

				var userslug = utils.slugify(data.username);

				if(userslug === userData.userslug) {
					return next(null, true);
				}

				if(!utils.isUserNameValid(data.username) || !userslug) {
					return next(new Error('Invalid Username!'), false);
				}

				User.exists(userslug, function(err, exists) {
					if(err) {
						return next(err);
					}

					if(exists) {
						next(new Error('Username not available!'), false);
					} else {
						next(null, true);
					}
				});
			});
		}

		async.series([isSignatureValid, isEmailAvailable, isUsernameAvailable], function(err, results) {
			if (err) {
				return callback(err, returnData);
			}

			async.each(fields, updateField, function(err) {
				if (err) {
					return callback(err, returnData);
				}

				returnData.success = true;
				callback(null, returnData);
			});
		});

		function updateField(field, next) {
			if (!(data[field] !== undefined && typeof data[field] === 'string')) {
				return next();
			}

			data[field] = data[field].trim();
			data[field] = validator.escape(data[field]);

			if (field === 'email') {
				User.getUserFields(uid, ['email', 'picture', 'uploadedpicture'], function(err, userData) {
					if (err) {
						return next(err);
					}

					if(userData.email === data.email) {
						return next();
					}

					var gravatarpicture = User.createGravatarURLFromEmail(data.email);
					User.setUserField(uid, 'gravatarpicture', gravatarpicture);

					db.deleteObjectField('email:uid', userData.email);
					db.setObjectField('email:uid', data.email, uid);
					User.setUserField(uid, 'email', data.email);
					if (userData.picture !== userData.uploadedpicture) {
						returnData.picture = gravatarpicture;
						User.setUserField(uid, 'picture', gravatarpicture);
					}
					returnData.gravatarpicture = gravatarpicture;

					events.logEmailChange(uid, userData.email, data.email);
					next();
				});
				return;
			} else if (field === 'username') {

				User.getUserFields(uid, ['username', 'userslug'], function(err, userData) {
					var userslug = utils.slugify(data.username);

					if(data.username !== userData.username) {
						User.setUserField(uid, 'username', data.username);
						db.deleteObjectField('username:uid', userData.username);
						db.setObjectField('username:uid', data.username, uid);
						events.logUsernameChange(uid, userData.username, data.username);
					}

					if(userslug !== userData.userslug) {
						User.setUserField(uid, 'userslug', userslug);
						db.deleteObjectField('userslug:uid', userData.userslug);
						db.setObjectField('userslug:uid', userslug, uid);
						returnData.userslug = userslug;
					}

					next();
				});

				return;
			} else if (field === 'signature') {
				data[field] = S(data[field]).stripTags().s;
			} else if (field === 'website') {
				if(data[field].substr(0, 7) !== 'http://' && data[field].substr(0, 8) !== 'https://') {
					data[field] = 'http://' + data[field];
				}
			}

			User.setUserField(uid, field, data[field]);

			next();
		}
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

	User.changePassword = function(uid, data, callback) {
		if(!data || !data.uid) {
			return callback(new Error('invalid-uid'));
		}

		function hashAndSetPassword(callback) {
			User.hashPassword(data.newPassword, function(err, hash) {
				if(err) {
					return callback(err);
				}

				User.setUserField(data.uid, 'password', hash, function(err) {
					if(err) {
						return callback(err);
					}

					if(parseInt(uid, 10) === parseInt(data.uid, 10)) {
						events.logPasswordChange(data.uid);
					} else {
						events.logAdminChangeUserPassword(uid, data.uid);
					}

					callback();
				});
			});
		}

		if (!utils.isPasswordValid(data.newPassword)) {
			return callback(new Error('Invalid password!'));
		}

		if(parseInt(uid, 10) !== parseInt(data.uid, 10)) {
			User.isAdministrator(uid, function(err, isAdmin) {
				if(err || !isAdmin) {
					return callback(err || new Error('not-allowed'));
				}

				hashAndSetPassword(callback);
			});
		} else {
			User.getUserField(uid, 'password', function(err, currentPassword) {
				if(err) {
					return callback(err);
				}

				if (currentPassword !== null) {
					bcrypt.compare(data.currentPassword, currentPassword, function(err, res) {
						if (err || !res) {
							return callback(err || new Error('Your current password is not correct!'));
						}

						hashAndSetPassword(callback);
					});
				} else {
					// No password in account (probably SSO login)
					hashAndSetPassword(callback);
				}
			});
		}
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

		db.getSortedSetRevRange(set, start, stop, function(err, uids) {
			if (err) {
				return callback(err);
			}

			User.getUsersData(uids, function(err, users) {
				if (err) {
					return callback(err);
				}

				async.map(users, function(user, next) {
					if (!user) {
						return next(null, user);
					}

					if (!user.status) {
						user.status = 'online';
					}

					User.isAdministrator(user.uid, function(err, isAdmin) {
						if (err) {
							return next(err);
						}

						user.administrator = isAdmin ? '1':'0';

						if(set === 'users:online') {
							return next(null, user);
						}

						db.sortedSetScore('users:online', user.uid, function(err, score) {
							if (err) {
								return next(err);
							}

							if(!score) {
								user.status = 'offline';
							}

							next(null, user);
						});
					});
				}, callback);
			});
		});
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
			callback(password);
			return;
		}

		bcrypt.genSalt(nconf.get('bcrypt_rounds'), function(err, salt) {
			bcrypt.hash(password, salt, callback);
		});
	};

	User.getUsersCSV = function(callback) {
		var csvContent = '';

		db.getObjectValues('username:uid', function(err, uids) {
			if (err) {
				return callback(err);
			}

			User.getMultipleUserFields(uids, ['email', 'username'], function(err, usersData) {
				if (err) {
					return callback(err);
				}

				usersData.forEach(function(user, index) {
					if (user) {
						csvContent += user.email + ',' + user.username + ',' + uids[index] + '\n';
					}
				});

				callback(null, csvContent);
			});
		});
	};

	User.search = function(query, callback) {
		if (!query || query.length === 0) {
			return callback(null, {timing:0, users:[]});
		}
		var start = process.hrtime();

		db.getObject('username:uid', function(err, usernamesHash) {
			if (err) {
				return callback(null, {timing: 0, users:[]});
			}

			query = query.toLowerCase();

			var	usernames = Object.keys(usernamesHash),
				uids = [];

			uids = usernames.filter(function(username) {
				return username.toLowerCase().indexOf(query) === 0;
			})
			.slice(0, 10)
			.sort(function(a, b) {
				return a > b;
			})
			.map(function(username) {
				return usernamesHash[username];
			});

			User.getUsersData(uids, function(err, userdata) {
				if (err) {
					return callback(err);
				}
				var diff = process.hrtime(start);
				var timing = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(1);
				callback(null, {timing: timing, users: userdata});
			});
		});
	};

	User.onNewPostMade = function(uid, tid, pid, timestamp) {
		User.addPostIdToUser(uid, pid, timestamp);

		User.incrementUserFieldBy(uid, 'postcount', 1, function(err, newpostcount) {
			db.sortedSetAdd('users:postcount', newpostcount, uid);
		});

		User.setUserField(uid, 'lastposttime', timestamp);
	};

	User.addPostIdToUser = function(uid, pid, timestamp) {
		db.sortedSetAdd('uid:' + uid + ':posts', timestamp, pid);
	};

	User.addTopicIdToUser = function(uid, tid, timestamp) {
		db.sortedSetAdd('uid:' + uid + ':topics', timestamp, tid);
	};

	User.getPostIds = function(uid, start, stop, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':posts', start, stop, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if (pids && pids.length) {
				callback(null, pids);
			} else {
				callback(null, []);
			}
		});
	};

	User.follow = function(uid, followuid, callback) {
		toggleFollow('follow', uid, followuid, callback);
	};

	User.unfollow = function(uid, unfollowuid, callback) {
		toggleFollow('unfollow', uid, unfollowuid, callback);
	};

	function toggleFollow(type, uid, theiruid, callback) {
		var command = type === 'follow' ? 'setAdd' : 'setRemove';
		db[command]('following:' + uid, theiruid, function(err) {
			if(err) {
				return callback(err);
			}
			db[command]('followers:' + theiruid, uid, callback);
		});
	}

	User.getFollowing = function(uid, callback) {
		getFollow('following:' + uid, callback);
	};

	User.getFollowers = function(uid, callback) {
		getFollow('followers:' + uid, callback);
	};

	function getFollow(set, callback) {
		db.getSetMembers(set, function(err, uids) {
			if(err) {
				return callback(err);
			}

			User.getUsersData(uids, callback);
		});
	}

	User.getFollowingCount = function(uid, callback) {
		db.setCount('following:' + uid, callback);
	};

	User.getFollowerCount = function(uid, callback) {
		db.setCount('followers:' + uid, callback);
	};

	User.getFollowStats = function (uid, callback) {
		async.parallel({
			followingCount: function(next) {
				User.getFollowingCount(uid, next);
			},
			followerCount : function(next) {
				User.getFollowerCount(uid, next);
			}
		}, callback);
	};




	User.isFollowing = function(uid, theirid, callback) {
		db.isSetMember('following:' + uid, theirid, callback);
	};

	User.exists = function(userslug, callback) {
		User.getUidByUserslug(userslug, function(err, exists) {
			callback(err, !! exists);
		});
	};

	User.count = function(callback) {
		db.getObjectField('global', 'userCount', function(err, count) {
			if(err) {
				return callback(err);
			}

			callback(null, {
				count: count ? count : 0
			});
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

	User.isModerator = function(uid, cid, callback) {
		groups.isMemberByGroupName(uid, 'cid:' + cid + ':privileges:mods', callback);
	};

	User.isAdministrator = function(uid, callback) {
		groups.isMemberByGroupName(uid, 'administrators', callback);
	};

	User.logIP = function(uid, ip) {
		db.sortedSetAdd('uid:' + uid + ':ip', +new Date(), ip || 'Unknown');
	};

	User.getIPs = function(uid, end, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':ip', 0, end, function(err, ips) {
			if(err) {
				return callback(err);
			}

			callback(null, ips.map(function(ip) {
				return {ip:ip};
			}));
		});
	};


}(exports));
