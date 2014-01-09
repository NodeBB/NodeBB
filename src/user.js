var bcrypt = require('bcrypt'),
	async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),
	gravatar = require('gravatar'),
	check = require('validator').check,
	sanitize = require('validator').sanitize,
	S = require('string'),

	utils = require('./../public/src/utils'),
	plugins = require('./plugins'),
	db = require('./database'),
	meta = require('./meta'),
	groups = require('./groups'),
	notifications = require('./notifications'),
	topics = require('./topics'),
	events = require('./events'),
	Emailer = require('./emailer'),
	websockets = require('./websockets');

(function(User) {
	'use strict';
	User.create = function(username, password, email, callback) {
		var userslug = utils.slugify(username);

		username = username.trim();
		if (email !== undefined) {
			email = email.trim();
		}

		async.parallel([
			function(next) {
				if (email !== undefined) {
					next(!utils.isEmailValid(email) ? new Error('Invalid Email!') : null);
				} else {
					next();
				}
			},
			function(next) {
				next((!utils.isUserNameValid(username) || !userslug) ? new Error('Invalid Username!') : null);
			},
			function(next) {
				if (password !== undefined) {
					next(!utils.isPasswordValid(password) ? new Error('Invalid Password!') : null);
				} else {
					next();
				}
			},
			function(next) {
				User.exists(userslug, function(exists) {
					next(exists ? new Error('Username taken!') : null);
				});
			},
			function(next) {
				if (email !== undefined) {
					User.isEmailAvailable(email, function(err, available) {
						if (err) {
							return next(err);
						}
						next(!available ? new Error('Email taken!') : null);
					});
				} else {
					next();
				}
			}
		], function(err, results) {
			if (err) {
				return callback(err);
			}

			db.incrObjectField('global', 'nextUid', function(err, uid) {
				if(err) {
					return callback(err);
				}

				var gravatar = User.createGravatarURLFromEmail(email);
				var timestamp = Date.now();

				db.setObject('user:' + uid, {
					'uid': uid,
					'username': username,
					'userslug': userslug,
					'fullname': '',
					'location': '',
					'birthday': '',
					'website': '',
					'email': email || '',
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
					'showemail': 0
				});

				db.setObjectField('username:uid', username, uid);
				db.setObjectField('userslug:uid', userslug, uid);

				if (email !== undefined) {
					db.setObjectField('email:uid', email, uid);
					if (uid !== 1) User.email.verify(uid, email);
				}

				plugins.fireHook('action:user.create', {uid: uid, username: username, email: email, picture: gravatar, timestamp: timestamp});
				db.incrObjectField('global', 'userCount');

				db.sortedSetAdd('users:joindate', timestamp, uid);
				db.sortedSetAdd('users:postcount', 0, uid);
				db.sortedSetAdd('users:reputation', 0, uid);

				db.searchIndex('user', username, uid);

				if (password !== undefined) {
					User.hashPassword(password, function(err, hash) {
						User.setUserField(uid, 'password', hash);
						callback(null, uid);
					});
				} else {
					callback(null, uid);
				}
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
		if (uids.length === 0) {
			return callback(null, []);
		}

		var returnData = [];

		var uuids = uids.filter(function(value, index, self) {
			return self.indexOf(value) === index;
		});

		function iterator(uid, next) {
			User.getUserFields(uid, fields, function(err, userData) {
				if (err) {
					return next(err);
				}
				returnData.push(userData);
				next(null);
			});
		}

		async.eachSeries(uuids, iterator, function(err) {
			callback(err, returnData);
		});
	};

	User.getUserData = function(uid, callback) {
		db.getObject('user:' + uid, function(err, data) {
			if(err) {
				return callback(err);
			}

			if (data && data.password) {
				delete data.password;
			}
			callback(err, data);
		});
	};

	User.updateProfile = function(uid, data, callback) {

		var fields = ['username', 'email', 'fullname', 'website', 'location', 'birthday', 'signature'];
		var returnData = {
			success: false
		};

		function isSignatureValid(next) {
			if (data.signature !== undefined && data.signature.length > meta.config.maximumSignatureLength) {
				next({
					error: 'Signature can\'t be longer than ' + meta.config.maximumSignatureLength + ' characters!'
				}, false);
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

				User.isEmailAvailable(data.email, function(err, available) {
					if (err) {
						return next(err, null);
					}

					if (!available) {
						next({
							error: 'Email not available!'
						}, false);
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
					return next({
						error: 'Invalid Username!'
					}, false);
				}

				User.exists(userslug, function(exists) {
					if(exists) {
						next({
							error: 'Username not available!'
						}, false);
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
			if (data[field] !== undefined && typeof data[field] === 'string') {
				data[field] = data[field].trim();
				data[field] = sanitize(data[field]).escape();

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
							db.searchRemove('user', uid, function() {
								db.searchIndex('user', data.username, uid);
							});
						}

						if(userslug !== userData.userslug) {
							User.setUserField(uid, 'userslug', userslug);
							db.deleteObjectField('userslug:uid', userData.userslug);
							db.setObjectField('userslug:uid', userslug, uid);
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
			} else {
				next();
			}
		}
	};

	User.isEmailAvailable = function(email, callback) {
		db.isObjectField('email:uid', email, function(err, exists) {
			callback(err, !exists);
		});
	};

	User.changePassword = function(uid, data, callback) {
		if (!utils.isPasswordValid(data.newPassword)) {
			return callback({
				error: 'Invalid password!'
			});
		}

		User.getUserField(uid, 'password', function(err, user_password) {
			bcrypt.compare(data.currentPassword, user_password, function(err, res) {
				if (err) {
					return callback(err);
				}

				if (res) {
					User.hashPassword(data.newPassword, function(err, hash) {
						User.setUserField(uid, 'password', hash);
						events.logPasswordChange(uid);
						callback(null);
					});
				} else {
					callback({
						error: 'Your current password is not correct!'
					});
				}
			});
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
		var data = [];

		db.getSortedSetRevRange(set, start, stop, function(err, uids) {
			if (err) {
				return callback(err, null);
			}

			function iterator(uid, callback) {
				User.getUserData(uid, function(err, userData) {
					User.isAdministrator(uid, function(err, isAdmin) {
						if (userData) {
							userData.administrator = isAdmin?"1":"0";
							data.push(userData);
						}
						callback(null);
					});
				});
			}

			async.eachSeries(uids, iterator, function(err) {
				callback(err, data);
			});
		});
	};

	User.createGravatarURLFromEmail = function(email) {
		var options = {
			size: '128',
			default: 'identicon',
			rating: 'pg'
		},
		https = nconf.get('https');

		if (!email) {
			email = '';
			options.forcedefault = 'y';
		}

		return gravatar.url(email, options, https);
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

	User.reIndexAll = function(callback) {
		User.getUsers('users:joindate', 0, -1, function(err, usersData) {
			if (err) {
				return callback(err, null);
			}

			function reIndexUser(uid, username) {
				db.searchRemove('user', uid, function() {
					db.searchIndex('user', username, uid);
				});
			}

			for (var i = 0; i < usersData.length; ++i) {
				reIndexUser(usersData[i].uid, usersData[i].username);
			}
			callback(null, 1);
		});
	};

	// thanks to @akhoury
	User.getUsersCSV = function(callback) {
		var csvContent = "";

		db.getObjectValues('username:uid', function(err, uids) {
			async.each(uids, function(uid, next) {
				User.getUserFields(uid, ['email', 'username'], function(err, userData) {
					if(err) {
						return next(err);
					}

					csvContent += userData.email+ ',' + userData.username + ',' + uid +'\n';
					next();
				});
			}, function(err) {
				if (err) {
					throw err;
				}

				callback(err, csvContent);
			});
		});
	}

	User.search = function(username, callback) {
		if (!username) {
			return callback([]);
		}

		db.search('user', username, function(err, uids) {
			if (err) {
				console.log(err);
				return;
			}
			if (uids && uids.length) {
				User.getDataForUsers(uids, function(userdata) {
					callback(userdata);
				});
			} else {
				callback([]);
			}
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

	User.follow = function(uid, followid, callback) {
		db.setAdd('following:' + uid, followid, function(err, data) {
			if (!err) {
				db.setAdd('followers:' + followid, uid, function(err, data) {
					if (!err) {
						callback(true);
					} else {
						console.log(err);
						callback(false);
					}
				});
			} else {
				console.log(err);
				callback(false);
			}
		});
	};

	User.unfollow = function(uid, unfollowid, callback) {
		db.setRemove('following:' + uid, unfollowid, function(err, data) {
			if (!err) {
				db.setRemove('followers:' + unfollowid, uid, function(err, data) {
					callback(data);
				});
			} else {
				console.log(err);
			}
		});
	};

	User.getFollowing = function(uid, callback) {
		db.getSetMembers('following:' + uid, function(err, userIds) {
			if (!err) {
				User.getDataForUsers(userIds, callback);
			} else {
				console.log(err);
			}
		});
	};

	User.getFollowers = function(uid, callback) {
		db.getSetMembers('followers:' + uid, function(err, userIds) {
			if (!err) {
				User.getDataForUsers(userIds, callback);
			} else {
				console.log(err);
			}
		});
	};

	User.getFollowingCount = function(uid, callback) {
		db.getSetMembers('following:' + uid, function(err, userIds) {
			if (err) {
				console.log(err);
			} else {
				userIds = userIds.filter(function(value) {
					return parseInt(value, 10) !== 0;
				});
				callback(userIds.length);
			}
		});
	};

	User.getFollowerCount = function(uid, callback) {
		db.getSetMembers('followers:' + uid, function(err, userIds) {
			if(err) {
				console.log(err);
			} else {
				userIds = userIds.filter(function(value) {
					return parseInt(value, 10) !== 0;
				});
				callback(userIds.length);
			}
		});
	};

	User.getDataForUsers = function(uids, callback) {
		var returnData = [];

		if (!uids || !Array.isArray(uids) || uids.length === 0) {
			callback(returnData);
			return;
		}

		function iterator(uid, callback) {
			if(parseInt(uid, 10) === 0) {
				return callback(null);
			}

			User.getUserData(uid, function(err, userData) {
				returnData.push(userData);

				callback(null);
			});
		}

		async.eachSeries(uids, iterator, function(err) {
			callback(returnData);
		});
	};

	User.sendPostNotificationToFollowers = function(uid, tid, pid) {
		User.getUserField(uid, 'username', function(err, username) {
			db.getSetMembers('followers:' + uid, function(err, followers) {
				topics.getTopicField(tid, 'slug', function(err, slug) {
					var message = '<strong>' + username + '</strong> made a new post';

					notifications.create(message, nconf.get('relative_path') + '/topic/' + slug + '#' + pid, 'topic:' + tid, function(nid) {
						notifications.push(nid, followers);
					});
				});
			});
		});
	};

	User.isFollowing = function(uid, theirid, callback) {
		db.isSetMember('following:' + uid, theirid, function(err, isMember) {
			if (!err) {
				callback(isMember);
			} else {
				console.log(err);
			}
		});
	};

	User.exists = function(userslug, callback) {
		User.getUidByUserslug(userslug, function(err, exists) {
			callback( !! exists);
		});
	};

	User.count = function(socket) {
		db.getObjectField('global', 'userCount', function(err, count) {
			if(err) {
				return;
			}

			socket.emit('user.count', {
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
		var usernames = [];

		if (!Array.isArray(uids)) {
			return callback([]);
		}

		function iterator(uid, callback) {
			User.getUserField(uid, 'username', function(err, username) {
				usernames.push(username);
				callback(null);
			});
		}

		async.eachSeries(uids, iterator, function(err) {
			callback(usernames);
		});
	};

	User.getUserSlugsByUids = function(uids, callback) {
		var userslugs = [];

		if (!Array.isArray(uids)) {
			return callback([]);
		}

		function iterator(uid, callback) {
			User.getUserField(uid, 'userslug', function(err, userslug) {
				userslugs.push(userslug);
				callback(null);
			});
		}

		async.eachSeries(uids, iterator, function(err) {
			callback(userslugs);
		});
	};

	User.getUidByEmail = function(email, callback) {
		db.getObjectField('email:uid', email, function(err, data) {
			if (err) {
				return callback(err);
			}
			callback(null, data);
		});
	};

	User.getUidByTwitterId = function(twid, callback) {
		db.getObjectField('twid:uid', twid, function(err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	User.getUidByGoogleId = function(gplusid, callback) {
		db.getObjectField('gplusid:uid', gplusid, function(err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	User.getUidByFbid = function(fbid, callback) {
		db.getObjectField('fbid:uid', fbid, function(err, uid) {
			if (err) {
				return callback(err);
			}
			callback(null, uid);
		});
	};

	User.isModerator = function(uid, cid, callback) {
		db.isSetMember('cid:' + cid + ':moderators', uid, function(err, exists) {
			if(err) {
				return calback(err);
			}
			callback(err, exists);
		});
	};

	User.isAdministrator = function(uid, callback) {
		groups.getGidFromName('Administrators', function(err, gid) {
			groups.isMember(uid, gid, function(err, isAdmin) {
				callback(err, isAdmin);
			});
		});
	};

	User.reset = {
		validate: function(socket, code, callback) {

			if (typeof callback !== 'function') {
				callback = null;
			}

			db.getObjectField('reset:uid', code, function(err, uid) {
				if (err) {
					return callback(false);
				}

				if (uid !== null) {
					db.getObjectField('reset:expiry', code, function(err, expiry) {
						if (err) {
							return callback(false);
						}

						if (expiry >= +Date.now() / 1000 | 0) {
							if (!callback) {
								socket.emit('user:reset.valid', {
									valid: true
								});
							} else {
								callback(true);
							}
						} else {
							// Expired, delete from db
							db.deleteObjectField('reset:uid', code);
							db.deleteObjectField('reset:expiry', code);
							if (!callback) {
								socket.emit('user:reset.valid', {
									valid: false
								});
							} else {
								callback(false);
							}
						}
					});
				} else {
					if (!callback) {
						socket.emit('user:reset.valid', {
							valid: false
						});
					} else {
						callback(false);
					}
				}
			});
		},
		send: function(socket, email) {
			User.getUidByEmail(email, function(err, uid) {
				if (uid !== null) {
					// Generate a new reset code
					var reset_code = utils.generateUUID();
					db.setObjectField('reset:uid', reset_code, uid);
					db.setObjectField('reset:expiry', reset_code, (60 * 60) + new Date() / 1000 | 0); // Active for one hour

					var reset_link = nconf.get('url') + 'reset/' + reset_code;

					Emailer.send('reset', uid, {
						'site_title': (meta.config['title'] || 'NodeBB'),
						'reset_link': reset_link,

						subject: 'Password Reset Requested - ' + (meta.config['title'] || 'NodeBB') + '!',
						template: 'reset',
						uid: uid
					});

					socket.emit('user.send_reset', {
						status: "ok",
						message: "code-sent",
						email: email
					});
				} else {
					socket.emit('user.send_reset', {
						status: "error",
						message: "invalid-email",
						email: email
					});
				}
			});
		},
		commit: function(socket, code, password) {
			this.validate(socket, code, function(validated) {
				if (validated) {
					db.getObjectField('reset:uid', code, function(err, uid) {
						if (err) {
							return;
						}

						User.hashPassword(password, function(err, hash) {
							User.setUserField(uid, 'password', hash);
							events.logPasswordReset(uid);
						});

						db.deleteObjectField('reset:uid', code);
						db.deleteObjectField('reset:expiry', code);

						socket.emit('user:reset.commit', {
							status: 'ok'
						});
					});
				}
			});
		}
	};

	User.pushNotifCount = function(uid) {
		User.notifications.getUnreadCount(uid, function(err, count) {
			if (!err) {
				websockets.in('uid_' + uid).emit('event:notifications.updateCount', count);
			} else {
				winston.warn('[User.pushNotifCount] Count not retrieve unread notifications count to push to uid ' + uid + '\'s client(s)');
			}
		});
	};

	User.email = {
		verify: function(uid, email) {
			var confirm_code = utils.generateUUID(),
				confirm_link = nconf.get('url') + 'confirm/' + confirm_code;

			async.series([
				function(next) {
					db.setObject('confirm:' + confirm_code, {
						email: email,
						uid: uid
					}, next);
				},
				function(next) {
					db.expireAt('confirm:' + confirm_code, Math.floor(Date.now() / 1000 + 60 * 60 * 2), next);
				}
			], function(err) {
				// Send intro email w/ confirm code
				User.getUserField(uid, 'username', function(err, username) {
					Emailer.send('welcome', uid, {
						'site_title': (meta.config['title'] || 'NodeBB'),
						username: username,
						'confirm_link': confirm_link,

						subject: 'Welcome to ' + (meta.config['title'] || 'NodeBB') + '!',
						template: 'welcome',
						uid: uid
					});
				});
			});
		},
		exists: function(socket, email, callback) {
			User.getUidByEmail(email, function(err, exists) {
				exists = !! exists;
				if (typeof callback !== 'function') {
					socket.emit('user.email.exists', {
						exists: exists
					});
				} else {
					callback(exists);
				}
			});
		},
		confirm: function(code, callback) {
			db.getObject('confirm:' + code, function(err, confirmObj) {
				if (err) {
					callback({
						status:'error'
					});
				} else {
					if (confirmObj.uid && confirmObj.email) {
						db.setObjectField('email:confirmed', confirmObj.email, '1', function() {
							callback({
								status: 'ok'
							});
						});
					} else {
						callback({
							status: 'not_ok'
						});
					}
				}
			});
		}
	};

	User.notifications = {
		get: function(uid, callback) {
			var maxNotifs = 15;

			async.parallel({
				unread: function(next) {
					db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 10, function(err, nids) {
						// @todo handle err
						var unread = [];

						// Cap the number of notifications returned
						if (nids.length > maxNotifs) {
							nids.length = maxNotifs;
						}

						if (nids && nids.length > 0) {
							async.eachSeries(nids, function(nid, next) {
								notifications.get(nid, uid, function(notif_data) {
									// If the notification could not be found, silently drop it
									if (notif_data) {
										unread.push(notif_data);
									} else {
										db.sortedSetRemove('uid:' + uid + ':notifications:unread', nid);
									}

									next();
								});
							}, function(err) {
								next(null, unread);
							});
						} else {
							next(null, unread);
						}
					});
				},
				read: function(next) {
					db.getSortedSetRevRange('uid:' + uid + ':notifications:read', 0, 10, function(err, nids) {
						// @todo handle err
						var read = [];

						// Cap the number of notifications returned
						if (nids.length > maxNotifs) {
							nids.length = maxNotifs;
						}

						if (nids && nids.length > 0) {
							async.eachSeries(nids, function(nid, next) {
								notifications.get(nid, uid, function(notif_data) {
									// If the notification could not be found, silently drop it
									if (notif_data) {
										read.push(notif_data);
									} else {
										db.sortedSetRemove('uid:' + uid + ':notifications:read', nid);
									}

									next();
								});
							}, function(err) {
								next(null, read);
							});
						} else {
							next(null, read);
						}
					});
				}
			}, function(err, notifications) {
				// Limit the number of notifications to `maxNotifs`, prioritising unread notifications
				if (notifications.read.length + notifications.unread.length > maxNotifs) {
					notifications.read.length = maxNotifs - notifications.unread.length;
				}

				callback(notifications);
			});
		},
		getAll: function(uid, limit, before, callback) {
			var	now = new Date();

			if (!limit || parseInt(limit,10) <= 0) {
				limit = 25;
			}
			if (before) {
				before = new Date(parseInt(before, 10));
			}

			var args1 = ['uid:' + uid + ':notifications:read', before ? before.getTime(): now.getTime(), -Infinity, 'LIMIT', 0, limit];
			var args2 = ['uid:' + uid + ':notifications:unread', before ? before.getTime(): now.getTime(), -Infinity, 'LIMIT', 0, limit];

			db.getSortedSetRevRangeByScore(args1, function(err, results1) {
				db.getSortedSetRevRangeByScore(args2, function(err, results2) {

					var nids = results1.concat(results2);
					async.map(nids, function(nid, next) {
						notifications.get(nid, uid, function(notif_data) {
							next(null, notif_data);
						});
					}, function(err, notifs) {
						notifs = notifs.filter(function(notif) {
							return notif !== null;
						}).sort(function(a, b) {
							return parseInt(b.datetime, 10) - parseInt(a.datetime, 10);
						}).map(function(notif) {
							notif.datetimeISO = new Date(parseInt(notif.datetime, 10)).toISOString();
							notif.readClass = !notif.read ? 'unread' : '';

							return notif;
						});

						callback(err, notifs);
					});
				});
			});

		},
		getUnreadCount: function(uid, callback) {
			db.sortedSetCount('uid:' + uid + ':notifications:unread', -Infinity, Infinity, callback);
		},
		getUnreadByUniqueId: function(uid, uniqueId, callback) {
			db.getSortedSetRange('uid:' + uid + ':notifications:unread', 0, -1, function(err, nids) {

				async.filter(nids, function(nid, next) {
					notifications.get(nid, uid, function(notifObj) {
						if(!notifObj) {
							next(false);
						}
						if (notifObj.uniqueId === uniqueId) {
							next(true);
						} else {
							next(false);
						}
					});
				}, function(nids) {
					callback(null, nids);
				});
			});
		}
	};
}(exports));
