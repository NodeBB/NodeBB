var utils = require('./../public/src/utils.js'),
	RDB = require('./redis.js'),
	crypto = require('crypto'),
	emailjs = require('emailjs'),
	emailjsServer = emailjs.server.connect(config.mailer),
	bcrypt = require('bcrypt'),
	marked = require('marked'),
	notifications = require('./notifications.js'),
	topics = require('./topics.js'),
	async = require('async');

(function(User) {
	
	User.create = function(username, password, email, callback) {
		username = username.trim(), email = email.trim();

		// @todo return a proper error? use node-validator?
		if(!utils.isEmailValid(email) || !utils.isUserNameValid(username) || !utils.isPasswordValid(password)) {
			console.log('Invalid email/username/password!');
			callback(null, 0);
			return;
		}

		var userslug = utils.slugify(username);

		User.exists(userslug, function(exists) {
			if(exists) {
				callback(null, 0);
				return;
			}
			
			User.isEmailAvailable(email, function(available) {
				if(!available) {
					callback(null, 0);
					return;
				}

				RDB.incr('global:next_user_id', function(err, uid) {
					RDB.handle(err);

					var gravatar = User.createGravatarURLFromEmail(email);

					RDB.hmset('user:'+uid, {
						'uid': uid,
						'username' : username,
						'userslug' : userslug,
						'fullname': '',
						'location':'',
						'birthday':'',
						'website':'',
						'email' : email,
						'signature':'',
						'joindate' : Date.now(),
						'picture': gravatar,
						'gravatarpicture' : gravatar,
						'uploadedpicture': '',
						'reputation': 0,
						'postcount': 0,
						'lastposttime': 0,
						'administrator': (uid == 1) ? 1 : 0
					});
					
					RDB.set('username:' + username + ':uid', uid);
					RDB.set('email:' + email +':uid', uid);
					RDB.set('userslug:'+ userslug +':uid', uid);

					if(email) {
						User.sendConfirmationEmail(email);
					}

					RDB.incr('usercount', function(err, count) {
						RDB.handle(err);

						io.sockets.emit('user.count', {count: count});
					});

					RDB.lpush('userlist', uid);
					
					io.sockets.emit('user.latest', {userslug: userslug, username: username});

					if (password) {
						User.hashPassword(password, function(hash) {
							User.setUserField(uid, 'password', hash);
						});
					}

					callback(null, uid);
				});
			});
		});
	};
	
	User.delete = function(uid, callback) {
		RDB.exists('user:'+uid, function(err, exists) {
			if(exists === 1) {
				console.log('deleting uid ' + uid);

				User.getUserData(uid, function(data) {
					RDB.del('username:' + data['username'] + ':uid');
					RDB.del('email:' + data['email'] +':uid');
					RDB.del('userslug:'+ data['userslug'] +':uid');

					RDB.del('user:' + uid);
					RDB.del('followers:' + uid);
					RDB.del('following:' + uid);

					RDB.lrem('userlist', 1, uid);

					callback(true);
				});
			} else {
				callback(false);
			}
		});
	}
	
	User.getUserField = function(uid, field, callback) {
		RDB.hget('user:' + uid, field, function(err, data) {
			if(err === null) {
				callback(data);
			} else {
				console.log(err);
			}
		});
	}

	User.getUserFields = function(uid, fields, callback) {
		RDB.hmget('user:' + uid, fields, function(err, data) {
			if(err === null) {
				for(var i = 0, returnData = {}, ii=fields.length; i<ii; ++i) {
					returnData[fields[i]] = data[i];
				}

				callback(returnData);
			} else {
				console.log(err);
			}
		});
	}

	User.getMultipleUserFields = function(uids, fields, callback) {
		if(uids.length === 0) {
			callback({});
			return;
		}

		var returnData = [];

		uuids = uids.filter(function(value, index, self) {
			return self.indexOf(value) === index;
		});

		function iterator(uid, callback) {
			User.getUserFields(uid, fields, function(userData) {
				returnData.push(userData);
				callback(null);
			});
		}

		async.each(uuids, iterator, function(err) {
			if(!err) {
				callback(returnData);
			} else {
				console.log(err);
				callback(null);
			}
		});
	}

	User.getUserData = function(uid, callback) {
		RDB.hgetall('user:' + uid, function(err, data) {
			if(err === null) {
				if(data) {
					if(data['password'])
						delete data['password'];
				}
				callback(data);
			} else {
				console.log(err);
			}
		});
	}

	User.updateProfile = function(socket, uid, data) {

		var fields = ['email', 'fullname', 'website', 'location', 'birthday', 'signature'];

		function isSignatureValid(next) {
			if(data['signature'] !== undefined && data['signature'].length > 150) {
				next({error:'Signature can\'t be longer than 150 characters!'}, false);
			} else {
				next(null, true);	
			}			
		}
		
		function isEmailAvailable(next) {
			if(data['email'] !== undefined) {
				User.getUserField(uid, 'email', function(email) {
					if(email !== data['email']) {
						User.isEmailAvailable(data['email'], function(available) {
							if(!available) {						
								next({error:'Email not available!'}, false);
							}
						});
					} else {
						next(null, true);		
					}
				});
			} else {
				next(null, true);
			}
		}
		
		async.series([isSignatureValid, isEmailAvailable], function(err, results) {
			if(err) {
				socket.emit('event:alert', {
					title: 'Error',
					message: err.error,
					type: 'error',
					timeout: 2000
				});	
			} else {
				updateFields();
			}
		});

		function updateFields() {
			for(var i = 0, key, ii = fields.length; i < ii; ++i) {
				key = fields[i];

				if(data[key] !== undefined) {
					if(key === 'email') {
						User.setUserField(uid, 'gravatarpicture', User.createGravatarURLFromEmail(data[key]));
						RDB.set('email:' + data['email'] +':uid', uid);
					} else if(key === 'signature') {
						data[key] = utils.strip_tags(data[key]);
					}

					User.setUserField(uid, key, data[key]);
				}
			}

			socket.emit('event:alert', {
				title: 'Success',
				message: 'Your profile has been updated successfully!',
				type: 'success',
				timeout: 2000
			});	
		}
	}

	User.isEmailAvailable = function(email, callback) {
		RDB.exists('email:' + email + ':uid' , function(err, exists) {
			if(!err) {
				callback(exists !== 1);
				return;
			} else {
				console.log(err);
				callback(false);
			}
		});
	}

	User.changePassword = function(socket, uid, data, callback) {
		if(!utils.isPasswordValid(data.newPassword)) {
			socket.emit('event:alert', {
				title: 'Error',
				message: 'Invalid password!',
				type: 'error',
				timeout: 2000
			});		
			callback(false);
			return;		
		}

		User.getUserField(uid, 'password', function(user_password) {
			bcrypt.compare(data.currentPassword, user_password, function(err, res) {
				if(err) {
					console.log(err);
					callback(false);
					return;
				}

				if (res) {
					User.hashPassword(data.newPassword, function(hash) {
						User.setUserField(uid, 'password', hash);

						socket.emit('event:alert', {
							title: 'Success',
							message: 'Your password is updated!',
							type: 'success',
							timeout: 2000
						});	
						callback(true);
					});
				} else {
					socket.emit('event:alert', {
						title: 'Warning',
						message: 'Your current password is not correct!',
						type: 'warning',
						timeout: 2000
					});	
					callback(false);
				}
			});
		});
	}

	User.setUserField = function(uid, field, value) {
		RDB.hset('user:' + uid, field, value);
	}

	User.incrementUserFieldBy = function(uid, field, value) {
		RDB.hincrby('user:' + uid, field, value);
	}

	User.getUserList = function(callback) {
		var data = [];

		RDB.lrange('userlist', 0, -1, function(err, uids) {

			RDB.handle(err);
			
			function iterator(uid, callback) {
				User.getUserData(uid, function(userData) {
					data.push(userData);
					callback(null);
				});
			}
			
			async.each(uids, iterator, function(err) {
				if(!err) {
					callback(data);
				} else {
					console.log(err);
					callback(null);
				}
			});
		});
	}


	User.createGravatarURLFromEmail = function(email) {
		var forceDefault = ''
		if (!email) {
			email = '0000',
			forceDefault = '&forceDefault=y';
		}
		var emailHash = crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex');
		// @todo: https asset support?
		return 'http://www.gravatar.com/avatar/' + emailHash + '?default=identicon&s=128' + forceDefault;
	}

	User.hashPassword = function(password, callback) {
		if(!password) {
			callback(password);
			return;
		}

		// round count should be variable somewhere instead of hardcoded here
		// if an admin has the resources to up the round count, then making it easy for them to do so
		// can't hurt
		bcrypt.genSalt(10, function(err, salt) {
			bcrypt.hash(password, salt, function(err, hash) {
				callback(hash);
			});
		});
	}

	User.search = function(username, callback) {
		if(!username) {
			callback([]);
			return;
		}

		RDB.keys('username:*'+ username + '*:uid', function(err, keys) {
			if(!err) {
				if(keys && keys.length) {
					RDB.mget(keys, function(err, uids) {
						User.getDataForUsers(uids, function(userdata) {
							callback(userdata);
						});
					});
				} else {
					callback([]);
				}
			} else {
				console.log(err);
			}
		});
	}

	User.onNewPostMade = function(uid, tid, pid, timestamp) {
		User.addPostIdToUser(uid, pid)

		User.incrementUserFieldBy(uid, 'postcount', 1);
		User.setUserField(uid, 'lastposttime', timestamp);

		User.sendPostNotificationToFollowers(uid, tid, pid);
	}

	User.addPostIdToUser = function(uid, pid) {
		RDB.lpush('uid:' + uid + ':posts', pid);
	}

	User.addTopicIdToUser = function(uid, tid) {
		RDB.lpush('uid:' + uid + ':topics', tid);
	}

	User.getPostIds = function(uid, start, end, callback) {
		RDB.lrange('uid:' + uid + ':posts', start, end, function(err, pids) {
			if(!err) {
				if(pids && pids.length)
					callback(pids);
				else
					callback([]);
			} else {
				console.log(err);
				callback([]);
			}
		});
	}

	User.sendConfirmationEmail = function (email) {
		if (global.config['email:host'] && global.config['email:port'] && global.config['email:from']) {
			var confirm_code = utils.generateUUID(),
				confirm_link = config.url + 'confirm/' + confirm_code,
				confirm_email = global.templates['emails/header'] + global.templates['emails/email_confirm'].parse({'CONFIRM_LINK': confirm_link}) + global.templates['emails/footer'],
				confirm_email_plaintext = global.templates['emails/email_confirm_plaintext'].parse({ 'CONFIRM_LINK': confirm_link });

			// Email confirmation code
			var expiry_time = 60*60*2,	// Expire after 2 hours
				email_key = 'email:' + email + ':confirm',
				confirm_key = 'confirm:' + confirm_code + ':email';

			RDB.set(email_key, confirm_code);
			RDB.expire(email_key, expiry_time);
			RDB.set(confirm_key, email);
			RDB.expire(confirm_key, expiry_time);

				// Send intro email w/ confirm code
			var message = emailjs.message.create({
				text: confirm_email_plaintext,
				from: config.mailer.from,
				to: email,
				subject: '[NodeBB] Registration Email Verification',
				attachment: [
					{
						data: confirm_email,
						alternative: true
					}
				]
			});

			emailjsServer.send(message, function(err, success) {
				if (err) {
					console.log(err);
				}
			});
		}
	}

	User.follow = function(uid, followid, callback) {
		RDB.sadd('following:' + uid, followid, function(err, data) {
			if(!err) {
				RDB.sadd('followers:' + followid, uid, function(err, data) {
					if(!err) {
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
	}

	User.unfollow = function(uid, unfollowid, callback) {
		RDB.srem('following:' + uid, unfollowid, function(err, data){
			if(!err) {
				RDB.srem('followers:' + unfollowid, uid, function(err, data){
					callback(data);
				});
			} else {
				console.log(err);
			}
		});
	}

	User.getFollowing = function(uid, callback) {
		RDB.smembers('following:' + uid, function(err, userIds) {
			if(!err) {
				User.getDataForUsers(userIds, callback);
			} else {
				console.log(err);
			}
		});
	}

	User.getFollowers = function(uid, callback) {
		RDB.smembers('followers:' + uid, function(err, userIds) {
			if(!err) {
				User.getDataForUsers(userIds, callback);
			} else {
				console.log(err);
			}
		});
	}

	User.getFollowingCount = function(uid, callback) {
		RDB.smembers('following:' + uid, function(err, userIds) {
			if(!err) {
				callback(userIds.length);
			} else {
				console.log(err);
			}
		});
	}

	User.getFollowerCount = function(uid, callback) {
		RDB.smembers('followers:' + uid, function(err, userIds) {
			// @note why are error-handling styles being mixed?
			// either go with not-error-dosomething-else-dosomethingelse, or
			// go with if-error-dosomething-return
			// also why is console.log(err) being used when below we're using RDB.handle()?
			if(!err) {
				callback(userIds.length);
			} else {
				console.log(err);
			}
		});
	}

	User.getDataForUsers = function(uids, callback) {
		var returnData = [];

		if(!uids || !Array.isArray(uids) || uids.length === 0) {
			callback(returnData);
			return;
		}

		function iterator(uid, callback) {
			User.getUserData(uid, function(userData) {
				returnData.push(userData);

				callback(null);
			});
		}
		
		async.each(uids, iterator, function(err) {
			callback(returnData);
		});
	}

	User.sendPostNotificationToFollowers = function(uid, tid, pid) {
		User.getUserField(uid, 'username', function(username) {
			RDB.smembers('followers:' + uid, function(err, followers) {
				topics.getTopicField(tid, 'slug', function(slug) {
					var message = username + ' made a new post';

					notifications.create(message, 5, global.config.url + 'topic/' + slug + '#' + pid, 'notification_'+ Date.now(), function(nid) {
		 				notifications.push(nid, followers);
					});
				});
			});
		});
	}

	User.isFollowing = function(uid, theirid, callback) {
		RDB.sismember('following:' + uid, theirid, function(err, data) {
			if(!err) {
				callback(data === 1);
			} else {
				console.log(err);
			}
		});
	}

	User.exists = function(userslug, callback) {
		User.get_uid_by_userslug(userslug, function(exists) {
			callback(!!exists);
		});
	};

	User.count = function(socket) {
		RDB.get('usercount', function(err, count) {
			RDB.handle(err);

			socket.emit('user.count', { count: count ? count : 0 });
		});
	};

	User.latest = function(socket) {
		RDB.lrange('userlist', 0, 0, function(err, uid) {
			RDB.handle(err);

			User.getUserFields(uid, ['username', 'userslug'], function(userData) {
				socket.emit('user.latest', {userslug: userData.userslug, username: userData.username});
			});
		});
	}

	User.get_uid_by_username = function(username, callback) {
		RDB.get('username:' + username + ':uid', function(err, data) {
			if (err) {
				RDB.handle(err);
			}
			callback(data);
		});
	};

	User.get_uid_by_userslug = function(userslug, callback) {
		RDB.get('userslug:' + userslug + ':uid', function(err, data) {
			if (err) {
				RDB.handle(err);
			}
			callback(data);
		});
	};

	User.get_usernames_by_uids = function(uids, callback) {
		var usernames = [];

		if (!Array.isArray(uids)) {
			return callback([]);
		}

		function iterator(uid, callback) {
			User.getUserField(uid, 'username', function(username) {
				usernames.push(username);
				callback(null);
			});
		}

		async.each(uids, iterator, function(err) {
			callback(usernames);			
		});
	}

	User.get_userslugs_by_uids = function(uids, callback) {
		var userslugs = [];

		if (!Array.isArray(uids)) {
			return callback([]);
		}

		function iterator(uid, callback) {
			User.getUserField(uid, 'userslug', function(userslug) {
				userslugs.push(userslug);
				callback(null);
			});
		}

		async.each(uids, iterator, function(err) {
			callback(userslugs);			
		});
	}

	User.get_uid_by_email = function(email, callback) {
		RDB.get('email:' + email + ':uid', function(err, data) {
			if (err) {
				RDB.handle(err);
			}
			callback(data);
		});
	};

	User.get_uid_by_session = function(session, callback) {
		RDB.get('sess:' + session + ':uid', function(err, data) {
			if (err) {
				RDB.handle(err);
			}
			callback(data);
		});
	};

	User.get_uid_by_twitter_id = function(twid, callback) {
		RDB.hget('twid:uid', twid, function(err, uid) {
			if (err) {
				RDB.handle(err);
			}
			callback(uid);
		});
	}

	User.get_uid_by_google_id = function(gplusid, callback) {
		RDB.hget('gplusid:uid', gplusid, function(err, uid) {
			if (err) {
				RDB.handle(err);
			}
			callback(uid);
		});
	}

	User.get_uid_by_fbid = function(fbid, callback) {
		RDB.hget('fbid:uid', fbid, function(err, uid) {
			if (err) {
				RDB.handle(err);
			}
			callback(uid);
		});
	}

	User.session_ping = function(sessionID, uid) {
		// Start, replace, or extend a session
		RDB.get('sess:' + sessionID, function(err, session) {
			if (err) {
				RDB.handle(err);
			}

			var expiry = 60*60*24*14, // Login valid for two weeks
				sess_key = 'sess:' + sessionID + ':uid',
				uid_key = 'uid:' + uid + ':session';

			RDB.set(sess_key, uid);
			RDB.expire(sess_key, expiry);
			RDB.set(uid_key, sessionID);
			RDB.expire(uid_key, expiry);
		});
	}

	User.isModerator = function(uid, cid, callback) {
		RDB.sismember('cid:' + cid + ':moderators', uid, function(err, exists) {
			// @todo handle error
			callback(!!exists);
		});
	}

	User.isAdministrator = function(uid, callback) {
		RDB.sismember('administrators', uid, function(err, exists) {
			// @todo handle error
			callback(!!exists);
		});
	}

	User.makeAdministrator = function(uid, callback) {
		RDB.sadd('administrators', uid, function(err, data){
			if(!err) {
				User.setUserField(uid, 'administrator', 1);
			}

			if(callback) {
				// @todo address why we're only sending back a boolean in the callback and not an error if it occurred
				callback(err === null);
			}
		});
	}

	User.removeAdministrator = function(uid, callback) {
		RDB.srem('administrators', uid, function(err, data){
			if(!err) {
				User.setUserField(uid, 'administrator', 0);
			}

			if(callback) {
				// @todo address why we're only sending back a boolean in the callback and not an error if it occurred
				callback(err === null);
			}
		});
	}

	User.reset = {
		validate: function(socket, code, callback) {
			if (typeof callback !== 'function') {
				callback = null;
			}

			RDB.get('reset:' + code + ':uid', function(err, uid) {
				if (err) {
					RDB.handle(err);
				}

				if (uid !== null) {
					RDB.get('reset:' + code + ':expiry', function(err, expiry) {
						if (err) {
							RDB.handle(err);
						}

						if (expiry >= +Date.now()/1000|0) {
							if (!callback) {
								socket.emit('user:reset.valid', { valid: true });
							} else {
								callback(true);
							}
						} else {
							// Expired, delete from db
							RDB.del('reset:' + code + ':uid');
							RDB.del('reset:' + code + ':expiry');
							if (!callback) {
								socket.emit('user:reset.valid', { valid: false });
							} else {
								callback(false);
							}
						}
					});
				} else {
					if (!callback) {
						socket.emit('user:reset.valid', { valid: false });
					} else {
						callback(false);
					}
				}
			});
		},
		send: function(socket, email) {
			User.get_uid_by_email(email, function(uid) {
				if (uid !== null) {
					// Generate a new reset code
					var reset_code = utils.generateUUID();
					RDB.set('reset:' + reset_code + ':uid', uid);
					RDB.set('reset:' + reset_code + ':expiry', (60*60)+new Date()/1000|0);	// Active for one hour

					var reset_link = config.url + 'reset/' + reset_code,
						reset_email = global.templates['emails/reset'].parse({'RESET_LINK': reset_link}),
						reset_email_plaintext = global.templates['emails/reset_plaintext'].parse({ 'RESET_LINK': reset_link });

					var message = emailjs.message.create({
						text: reset_email_plaintext,
						from: config.mailer.from,
						to: email,
						subject: 'Password Reset Requested',
						attachment: [
							{
								data: reset_email,
								alternative: true
							}
						]
					});

					emailjsServer.send(message, function(err, success) {
						if (err === null) {
							socket.emit('user.send_reset', {
								status: "ok",
								message: "code-sent",
								email: email
							});
						} else {
							socket.emit('user.send_reset', {
								status: "error",
								message: "send-failed"
							});
							// @todo handle error properly
							throw new Error(err);
						}
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
			this.validate(code, function(validated) {
				if (validated) {
					RDB.get('reset:' + code + ':uid', function(err, uid) {
						if (err) {
							RDB.handle(err);
						}

						User.setUserField(uid, 'password', password);
						RDB.del('reset:' + code + ':uid');
						RDB.del('reset:' + code + ':expiry');

						socket.emit('user:reset.commit', { status: 'ok' });
					});
				}
			});
		}
	}

	User.email = {
		exists: function(socket, email, callback) {
			User.get_uid_by_email(email, function(exists) {
				exists = !!exists;
				if (typeof callback !== 'function') {
					socket.emit('user.email.exists', { exists: exists });
				} else {
					callback(exists);
				}
			});
		},
		confirm: function(code, callback) {
			RDB.get('confirm:' + code + ':email', function(err, email) {
				if (err) {
					RDB.handle(err);
				}

				if (email !== null) {
					RDB.set('email:' + email + ':confirm', true);
					RDB.del('confirm:' + code + ':email');
					callback({ status: 'ok' });
				} else {
					callback({ status: 'not_ok' });
				}
			});
		}
	};

	User.get_online_users = function(socket, uids) {
		RDB.sismembers('users:online', uids, function(err, data) {
			RDB.handle(err);
			socket.emit('api:user.get_online_users', data);
		});
	};

	User.go_online = function(uid) {
		RDB.sadd('users:online', uid, function(err) {
			if (err) {
				RDB.handle(err);
			}
		});
	};

	User.go_offline = function(uid) {
		RDB.srem('users:online', uid, function(err) {
			if (err) {
				RDB.handle(err);
			}
		});
	};


	User.active = {
		get_record : function(socket) {
			RDB.mget(['global:active_user_record', 'global:active_user_record_date'], function(err, data) {
				RDB.handle(err);
				socket.emit('api:user.active.get_record', { record: data[0], timestamp: data[1] });
			});
		},

		get: function(callback) {
			function user_record(total) {
				RDB.get('global:active_user_record', function(err, record) {
					RDB.handle(err);

					if (total > record) {
						RDB.set('global:active_user_record', total);
						RDB.set('global:active_user_record_date', Date.now());
					}
				});
			}

			RDB.keys('active:*', function(err, active) {
				RDB.handle(err);

				var returnObj = {
						users: 0,
						anon: 0,
						uids: []
					},
					keys = [];

				if (active.length > 0) {
					for(var a in active) {
						keys.push('sess:' + active[a].split(':')[1] + ':uid');
					}

					RDB.mget(keys, function(err, uids) {
						RDB.handle(err);

						for(var u in uids) {
							if (uids[u] !== null) {
								if (returnObj.uids.indexOf(uids[u]) === -1) {
									returnObj.users++;
									returnObj.uids.push(uids[u]);
								}
							} else {
								returnObj.anon++;
							}
						}

						user_record(returnObj.anon + returnObj.users);

						if (callback === undefined) {
							io.sockets.emit('api:user.active.get', returnObj)
						} else {
							callback(returnObj);
						}
					});
				} else {
					io.sockets.emit('api:user.active.get', returnObj)
				}
			});
		},
		register: function(sessionID) {
			// Active state persists for 10 minutes
			var active_session = 'active:' + sessionID;
			RDB.set(active_session, '');
			RDB.expire(active_session, 60*10)
			this.get();
		}
	}

	User.notifications = {
		get: function(uid, callback) {
			async.parallel({
				unread: function(next) {
					RDB.zrevrangebyscore('uid:' + uid + ':notifications:unread', 10, 0, function(err, nids) {
						// @todo handle err
						var unread = [];
						if (nids && nids.length > 0) {
							async.eachSeries(nids, function(nid, next) {
								notifications.get(nid, function(notif_data) {
									unread.push(notif_data);
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
					RDB.zrevrangebyscore('uid:' + uid + ':notifications:read', 10, 0, function(err, nids) {
						// @todo handle err
						var read = [];
						if (nids && nids.length > 0) {
							async.eachSeries(nids, function(nid, next) {
								notifications.get(nid, function(notif_data) {
									read.push(notif_data);
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
				// While maintaining score sorting, sort by time
				notifications.read.sort(function(a, b) {
					if (a.score === b.score) {
						return (a.datetime - b.datetime) > 0 ? -1 : 1;
					}
				});
				notifications.unread.sort(function(a, b) {
					if (a.score === b.score) {
						return (a.datetime - b.datetime) > 0 ? -1 : 1;
					}
				});
				callback(notifications);
			});
		},
		hasFlag: function(uid, callback) {
			RDB.get('uid:1:notifications:flag', function(err, flag) {
				if (err) {
					RDB.handle(err);
				}

				callback(flag === 1);
			});
		},
		removeFlag: function(uid) {
			RDB.del('uid:' + uid + ':notifications:flag', function(err) {
				if (err) {
					RDB.handle(err);
				}
			});
		}
	}
}(exports));
