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
	notifications = require('./notifications'),
	topics = require('./topics'),
	events = require('./events'),
	Emailer = require('./emailer');

(function(User) {

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
					User.isEmailAvailable(userData.email, function(err, available) {
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
		if (uids.length === 0) {
			return callback(null, []);
		}

		function getFields(uid, next) {
			User.getUserFields(uid, fields, next);
		}

		async.map(uids, getFields, callback);
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

	User.getSettings = function(uid, callback) {
		function sendDefaultSettings() {
			callback(null, {
				showemail: false,
				usePagination: parseInt(meta.config.usePagination, 10) !== 0,
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
			settings.usePagination = settings.usePagination ? parseInt(settings.usePagination, 10) !== 0 : parseInt(meta.config.usePagination, 10) !== 0;
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

				User.isEmailAvailable(data.email, function(err, available) {
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

	User.isEmailAvailable = function(email, callback) {
		db.isObjectField('email:uid', email, function(err, exists) {
			callback(err, !exists);
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

				bcrypt.compare(data.currentPassword, currentPassword, function(err, res) {
					if (err || !res) {
						return callback(err || new Error('Your current password is not correct!'));
					}

					hashAndSetPassword(callback);
				});
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
				return callback(err, null);
			}

			function getUserData(uid, callback) {
				User.getUserData(uid, function(err, userData) {
					if(!userData.status) {
						userData.status = 'online';
					}

					User.isAdministrator(uid, function(err, isAdmin) {
						if (userData) {
							userData.administrator = isAdmin ? '1':'0';
						}

						if(set === 'users:online') {
							return callback(null, userData);
						}

						db.sortedSetScore('users:online', uid, function(err, score) {
							if(!score) {
								userData.status = 'offline';
							}

							callback(null, userData);
						});
					});
				});
			}

			async.map(uids, getUserData, callback);
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
		var csvContent = "";

		db.getObjectValues('username:uid', function(err, uids) {
			if(err) {
				return callback(err);
			}

			async.each(uids, function(uid, next) {
				User.getUserFields(uid, ['email', 'username'], function(err, userData) {
					if(err) {
						return next(err);
					}

					csvContent += userData.email + ',' + userData.username + ',' + uid + '\n';
					next();
				});
			}, function(err) {
				callback(err, csvContent);
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
				results = [];

			results = usernames.filter(function(username) {
				return username.toLowerCase().indexOf(query) === 0;
			})
			.slice(0, 10)
			.sort(function(a, b) {
				return a > b;
			})
			.map(function(username) {
				return usernamesHash[username];
			});

			User.getDataForUsers(results, function(err, userdata) {
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

	User.follow = function(uid, followid, callback) {
		db.setAdd('following:' + uid, followid, function(err, data) {
			if(err) {
				return callback(err);
			}

			db.setAdd('followers:' + followid, uid, callback);
		});
	};

	User.unfollow = function(uid, unfollowid, callback) {
		db.setRemove('following:' + uid, unfollowid, function(err, data) {
			if(err) {
				return callback(err);
			}

			db.setRemove('followers:' + unfollowid, uid, callback);
		});
	};

	User.getFollowing = function(uid, callback) {
		db.getSetMembers('following:' + uid, function(err, userIds) {
			if(err) {
				return callback(err);
			}

			User.getDataForUsers(userIds, callback);
		});
	};

	User.getFollowers = function(uid, callback) {
		db.getSetMembers('followers:' + uid, function(err, userIds) {
			if(err) {
				return callback(err);
			}

			User.getDataForUsers(userIds, callback);
		});
	};

	User.getFollowingCount = function(uid, callback) {
		db.getSetMembers('following:' + uid, function(err, userIds) {
			if (err) {
				return callback(err);
			}

			userIds = userIds.filter(function(value) {
				return parseInt(value, 10) !== 0;
			});
			callback(null, userIds.length);
		});
	};

	User.getFollowerCount = function(uid, callback) {
		db.getSetMembers('followers:' + uid, function(err, userIds) {
			if(err) {
				return callback(err);
			}

			userIds = userIds.filter(function(value) {
				return parseInt(value, 10) !== 0;
			});
			callback(null, userIds.length);
		});
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

	User.getDataForUsers = function(uids, callback) {

		if (!uids || !Array.isArray(uids) || uids.length === 0) {
			return callback(null, []);
		}

		function getUserData(uid, next) {
			if(parseInt(uid, 10) === 0) {
				return next(null, null);
			}

			User.getUserData(uid, next);
		}

		async.map(uids, getUserData, callback);
	};

	User.sendPostNotificationToFollowers = function(uid, tid, pid) {
		User.getUserField(uid, 'username', function(err, username) {
			db.getSetMembers('followers:' + uid, function(err, followers) {
				if (followers && followers.length) {
					topics.getTopicField(tid, 'slug', function(err, slug) {
						var message = '<strong>' + username + '</strong> made a new post';

						notifications.create({
							text: message,
							path: nconf.get('relative_path') + '/topic/' + slug + '#' + pid,
							uniqueId: 'topic:' + tid,
							from: uid
						}, function(nid) {
							notifications.push(nid, followers);
						});
					});
				}
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

		if (!Array.isArray(uids)) {
			return callback(null, []);
		}

		function getUserName(uid, next) {
			User.getUserField(uid, 'username', next);
		}

		async.map(uids, getUserName, callback);
	};

	User.getUserSlugsByUids = function(uids, callback) {

		if (!Array.isArray(uids)) {
			return callback(null, []);
		}

		function getUserSlug(uid, next) {
			User.getUserField(uid, 'userslug', next);
		}

		async.map(uids, getUserSlug, callback);
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
		db.getObjectField('email:uid', email, function(err, data) {
			if (err) {
				return callback(err);
			}
			callback(null, data);
		});
	};

	User.isModerator = function(uid, cid, callback) {
		groups.isMemberByGroupName(uid, 'cid:' + cid + ':privileges:mod', callback);
	};

	User.isAdministrator = function(uid, callback) {
		groups.isMemberByGroupName(uid, 'administrators', callback);
	};

	User.reset = {
		validate: function(socket, code, callback) {

			db.getObjectField('reset:uid', code, function(err, uid) {
				if (err) {
					return callback(err);
				}

				if (uid !== null) {
					db.getObjectField('reset:expiry', code, function(err, expiry) {
						if (err) {
							return callback(err);
						}

						if (parseInt(expiry, 10) >= Date.now() / 1000) {
							callback(null, true);
						} else {
							// Expired, delete from db
							db.deleteObjectField('reset:uid', code);
							db.deleteObjectField('reset:expiry', code);
							callback(null, false);
						}
					});
				} else {
					callback(null, false);
				}
			});
		},
		send: function(socket, email, callback) {
			User.getUidByEmail(email, function(err, uid) {
				if(err) {
					return callback(err);
				}

				if(!uid) {
					return callback(new Error('invalid-email'));
				}

				// Generate a new reset code
				var reset_code = utils.generateUUID();
				db.setObjectField('reset:uid', reset_code, uid);
				db.setObjectField('reset:expiry', reset_code, (60 * 60) + Math.floor(Date.now() / 1000));

				var reset_link = nconf.get('url') + '/reset/' + reset_code;

				Emailer.send('reset', uid, {
					'site_title': (meta.config.title || 'NodeBB'),
					'reset_link': reset_link,

					subject: 'Password Reset Requested - ' + (meta.config.title || 'NodeBB') + '!',
					template: 'reset',
					uid: uid
				});

				callback(null);
			});
		},
		commit: function(socket, code, password, callback) {
			this.validate(socket, code, function(err, validated) {
				if(err) {
					return callback(err);
				}

				if (validated) {
					db.getObjectField('reset:uid', code, function(err, uid) {
						if (err) {
							return callback(err);
						}

						User.hashPassword(password, function(err, hash) {
							User.setUserField(uid, 'password', hash);
							events.logPasswordReset(uid);
						});

						db.deleteObjectField('reset:uid', code);
						db.deleteObjectField('reset:expiry', code);

						callback(null);
					});
				}
			});
		}
	};

	User.pushNotifCount = function(uid) {
		var	websockets = require('./socket.io');

		User.notifications.getUnreadCount(uid, function(err, count) {
			if (!err) {
				websockets.in('uid_' + uid).emit('event:notifications.updateCount', count);
			} else {
				winston.warn('[User.pushNotifCount] Count not retrieve unread notifications count to push to uid ' + uid + '\'s client(s)');
			}
		});
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

	User.email = {
		verify: function(uid, email) {
			if (!plugins.hasListeners('action:email.send')) {
				return;
			}

			var confirm_code = utils.generateUUID(),
				confirm_link = nconf.get('url') + '/confirm/' + confirm_code;

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
						'site_title': (meta.config.title || 'NodeBB'),
						username: username,
						'confirm_link': confirm_link,

						subject: 'Welcome to ' + (meta.config.title || 'NodeBB') + '!',
						template: 'welcome',
						uid: uid
					});
				});
			});
		},
		exists: function(email, callback) {
			User.getUidByEmail(email, function(err, exists) {
				callback(err, !!exists);
			});
		},
		confirm: function(code, callback) {
			db.getObject('confirm:' + code, function(err, confirmObj) {
				if (err) {
					return callback({
						status:'error'
					});
				}

				if (confirmObj && confirmObj.uid && confirmObj.email) {
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
			});
		}
	};

	User.notifications = {
		get: function(uid, callback) {

			function getNotifications(set, start, stop, iterator, done) {
				db.getSortedSetRevRange(set, start, stop, function(err, nids) {
					if(err) {
						return done(err);
					}

					if(!nids || nids.length === 0) {
						return done(null, []);
					}

					if (nids.length > maxNotifs) {
						nids.length = maxNotifs;
					}

					async.map(nids, function(nid, next) {
						notifications.get(nid, uid, function(notif_data) {
							if(typeof iterator === 'function') {
								iterator(notif_data);
							}

							next(null, notif_data);
						});
					}, done);
				});
			}

			var maxNotifs = 15;

			async.parallel({
				unread: function(next) {
					getNotifications('uid:' + uid + ':notifications:unread', 0, 9, function(notif_data) {
						if (notif_data) {
							notif_data.readClass = !notif_data.read ? 'label-warning' : '';
						}
					}, next);
				},
				read: function(next) {
					getNotifications('uid:' + uid + ':notifications:read', 0, 9, null, next);
				}
			}, function(err, notifications) {
				if(err) {
					return callback(err);
				}

				// Remove empties
				notifications.read = notifications.read.filter(function(notifObj) {
					return notifObj;
				});
				notifications.unread = notifications.unread.filter(function(notifObj) {
					return notifObj;
				});

				// Limit the number of notifications to `maxNotifs`, prioritising unread notifications
				if (notifications.read.length + notifications.unread.length > maxNotifs) {
					notifications.read.length = maxNotifs - notifications.unread.length;
				}

				callback(null, notifications);
			});
		},
		getAll: function(uid, limit, before, callback) {
			var	now = new Date();

			if (!limit || parseInt(limit, 10) <= 0) {
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
							notif.datetimeISO = utils.toISOString(notif.datetime);
							notif.readClass = !notif.read ? 'label-warning' : '';

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
							return next(false);
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
