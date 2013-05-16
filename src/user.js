

var config = require('../config.js'),
	utils = require('./utils.js'),
	RDB = require('./redis.js'),
	crypto = require('crypto'),
	emailjs = require('emailjs'),
	emailjsServer = emailjs.server.connect(config.mailer),
	bcrypt = require('bcrypt');

(function(User) {


	User.getUserField = function(uid, field, callback) {
		RDB.hget('user:'+uid, field, function(err, data){
			if(err === null)
				callback(data);
			else
				console.log(err);
		});
	}
	
	User.getUserFields = function(uid, fields, callback) {
		RDB.hmget('user:'+uid, fields, function(err, data){
			if(err === null) {
				var returnData = {};
				
				for(var i=0, ii=fields.length; i<ii; ++i) {
					returnData[fields[i]] = data[i];
				}

				callback(returnData);
			}
			else
				console.log(err);
		});		
	}

	// a function I feel should be built in user not sure how baris is tackling this so oppa chicken wrapper here
	User.getMultipleUserFields = function(uids, fields, callback) {
		if(uids.length === 0) {
			callback({});
			return;
		}

		var uuids = uids.filter(function(value, index, self) { 
		    return self.indexOf(value) === index;
		});

		var data = {},
			loaded = 0;


		for (var i=0, ii=uuids.length; i<ii; i++) {
			(function(user_id) {
				User.getUserFields(user_id, fields, function(user_data){
					data[user_id] = user_data;
					loaded ++;
					if (loaded == uuids.length) callback(data);
				});
			}(uuids[i]))
		}
	}

	User.getUserData = function(uid, callback) {

		RDB.hgetall('user:'+uid, function(err, data){
			if(err === null)
			{
				if(data && data['password'])
					delete data['password'];
				data.uid = uid;
				callback(data);
			}
			else
				console.log(err);
		});
	}

	User.updateProfile = function(uid, data) {
		
		var fields = ['email', 'fullname', 'website', 'location', 'birthday'];
		var key = '';
		
		for(var i=0,ii=fields.length; i<ii; ++i) {
			key = fields[i];
			if(data[key] !== undefined) {

				User.setUserField(uid, key, data[key]);
				
				if(key === 'email') {
					User.setUserField(uid, 'gravatarpicture', User.createGravatarURLFromEmail(data[key]));
				}
			}
		}
	}

	User.setUserField = function(uid, field, value) {
		RDB.hset('user:'+uid, field, value);				
	}

	User.incrementUserFieldBy = function(uid, field, value) {
		RDB.hincrby('user:'+uid, field, value);
	}

	User.getUserList = function(callback){
		var data = [];
		
		RDB.keys('user:*', function(err, userkeys){
			
			var anonUserIndex = userkeys.indexOf("user:0");
			if(anonUserIndex !== -1) {
				userkeys.splice(anonUserIndex, 1);
			}

			for(var i=0,ii=userkeys.length; i<ii; ++i) {
				RDB.hgetall(userkeys[i], function(err, userdata) {
					
					if(userdata && userdata.password)
						delete userdata.password;
					
					data.push(userdata);
					
					if(data.length == userkeys.length)
						callback(data);
				});
			}
		});
	}

	User.loginViaLocal = function(username, password, next) {

		if (!username || !password) {
			return next({
				status: 'error',
				message: 'invalid-user'
			});
		} else {
			RDB.get('username:' + username + ':uid', function(err, uid) {
				RDB.handle(err);

				if (uid == null) {
					return next({
						status: 'error',
						message: 'invalid-user'
					});
				}
				
				User.getUserField(uid, 'password', function(user_password) {
					bcrypt.compare(password, user_password, function(err, res) {
						if (res === true) {
							next({
								status: "ok",
								user: {
									uid: uid
								}
							});
						} else {
							next({
								status: 'error',
								message: 'invalid-password'
							});
						}
					});
				});
			});
		}
	}

	User.loginViaTwitter = function(twid, handle, callback) {
		User.get_uid_by_twitter_id(twid, function(uid) {
			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				User.create(handle, null, null, function(err, uid) {
					if (err !== null) {
						callback(err);
					} else {
						// Save twitter-specific information to the user
						RDB.set('uid:' + uid + ':twid', twid);
						RDB.set('twid:' + twid + ':uid', uid);
						callback(null, {
							uid: uid
						});
					}
				});
			}
		});
	}

	User.loginViaGoogle = function(gplusid, handle, email, callback) {
		User.get_uid_by_google_id(gplusid, function(uid) {
			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				User.create(handle, null, email, function(err, uid) {
					if (err !== null) {
						callback(err);
					} else {
						// Save twitter-specific information to the user
						RDB.set('uid:' + uid + ':gplusid', gplusid);
						RDB.set('gplusid:' + gplusid + ':uid', uid);
						callback(null, {
							uid: uid
						});
					}
				});
			}
		});
	}

	User.loginViaFacebook = function(fbid, name, email, callback) {
		User.get_uid_by_fbid(fbid, function(uid) {
			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				User.create(name, null, email, function(err, uid) {
					if (err !== null) {
						callback(err);
					} else {
						// Save twitter-specific information to the user
						RDB.set('uid:' + uid + ':fbid', fbid);
						RDB.set('fbid:' + fbid + ':uid', uid);
						callback(null, {
							uid: uid
						});
					}
				});
			}
		});
	}

	User.logout = function(sessionID, callback) {
		User.get_uid_by_session(sessionID, function(uid) {
			if (uid) {
				RDB.del('sess:' + sessionID + ':uid');
				RDB.del('uid:' + uid + ':session');
				callback(true);
			} else callback(false);
		});
	}

	User.create = function(username, password, email, callback) {

		User.exists(username, function(exists) {
			if (exists || email.indexOf('@') === -1 || password.length < 5) return callback(null, -1);

			RDB.incr('global:next_user_id', function(err, uid) {
				RDB.handle(err);
				User.hashPassword(password, function(hash) {
					var gravatar = User.createGravatarURLFromEmail(email);

					RDB.hmset('user:'+uid, {
						'username' : username,
						'fullname': '',
						'location':'',
						'birthday':'',
						'website':'',
						'email' : email,
						'joindate' : new Date().getTime(),
						'password' : hash,
						'picture': gravatar,
						'gravatarpicture' : gravatar,
						'uploadedpicture': '',
						'reputation': 0,
						'postcount': 0
					});
					
					RDB.set('username:' + username + ':uid', uid);
					RDB.set('email:' + email +':uid', uid);			
					
					if(email)
						User.sendConfirmationEmail(email);
				
					RDB.incr('usercount', function(err, count) {
						RDB.handle(err);
				
						io.sockets.emit('user.count', {count: count});
					});

					RDB.lpush('userlist', username);
					io.sockets.emit('user.latest', {username: username});

					callback(null, uid);
				});
			});
		});
	};

	User.createGravatarURLFromEmail = function(email) {
		if(email) {
			var md5sum = crypto.createHash('md5');
			md5sum.update((email || '').toLowerCase());
			var gravatarURL = 'http://www.gravatar.com/avatar/' + md5sum.digest('hex');
			return gravatarURL;
		}
		else {
			return "http://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e";	
		}
	}

	User.hashPassword = function(password, callback) {
		if(!password) {
			callback(password);
			return;
		}
		
		bcrypt.genSalt(10, function(err, salt) {
			bcrypt.hash(password, salt, function(err, hash) {
				callback(hash);	
			});
		});
	}

	User.sendConfirmationEmail = function (email) {
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
			if (err) 
				console.log(err);
		});	
	}

	User.addFriend = function(uid, friendid, callback) {
		RDB.sadd('user:'+uid+':friends', friendid, function(err, data){
			if(err === null) 
				callback(data);
			else
				console.log(err);
		})
	}

	User.getFriends = function(uid, callback) {
		RDB.smembers('user:'+uid+':friends', function(err, data){
			if(err === null){ 
				
				var friendsData = [];

				if(data.length === 0) {
					callback(friendsData);
					return;
				}

				for(var i=0, ii=data.length; i<ii; ++i) {
					User.getUserData(data[i], function(userData){
						friendsData.push(userData);
						
						if(friendsData.length == data.length)
							callback(friendsData);			
					});	
				}
			}
			else
				console.log(err);	
		});
	}

	User.removeFriend = function(uid, friendid, callback) {
		RDB.srem('user:'+uid+':friends', friendid, function(err, data){
			if(err === null)
				callback(data);
			else
				console.log(err);
		});
	}

	User.isFriend = function(uid, friendid, callback) {
		RDB.sismember('user:'+uid+':friends', friendid, function(err, data){
			if(err === null){
				callback(data === 1);
			}
			else
				console.log(err);
		});
	}

	User.exists = function(username, callback) {
		User.get_uid_by_username(username, function(exists) {
			exists = !!exists;

			if (callback) 
				callback(exists);
		});
	};
	
	User.count = function(socket) {
		RDB.get('usercount', function(err, count) {
			RDB.handle(err);
			socket.emit('user.count', {count: (count === null) ? 0 : count});
		});
	};
	
	User.latest = function(socket) {
		RDB.lrange('userlist', 0, 0, function(err, username) {
			RDB.handle(err);
			socket.emit('user.latest', {username: username});
		});	
	}

	User.get_uid_by_username = function(username, callback) {
		RDB.get('username:' + username + ':uid', function(err, data) {
			RDB.handle(err);
			callback(data);
		});
	};

	User.get_usernames_by_uids = function(uids, callback) {
		
		var usernames = [];
		
		for(var i=0, ii=uids.length; i<ii; ++i) {
		
			User.getUserField(uids[i],'username', function(username){

				usernames.push(username);

				if(usernames.length >= uids.length)
					callback(usernames);
			});
		}
	};

	User.get_uid_by_email = function(email, callback) {
		RDB.get('email:' + email + ':uid', function(err, data) {
			RDB.handle(err);
			callback(data);
		});
	};

	User.get_uid_by_session = function(session, callback) {
		RDB.get('sess:' + session + ':uid', function(err, data) {
			RDB.handle(err);
			callback(data);
		});
	};

	User.get_uid_by_twitter_id = function(twid, callback) {
		RDB.get('twid:' + twid + ':uid', function(err, uid) {
			RDB.handle(err);			
			callback(uid);
		});
	}

	User.get_uid_by_google_id = function(gplusid, callback) {
		RDB.get('gplusid:' + gplusid + ':uid', function(err, uid) {
			RDB.handle(err);
			callback(uid);
		});	
	}

	User.get_uid_by_fbid = function(fbid, callback) {
		RDB.get('fbid:' + fbid + ':uid', function(err, uid) {
			RDB.handle(err);
			callback(uid);
		});	
	}

	User.session_ping = function(sessionID, uid) {
		// Start, replace, or extend a session
		RDB.get('sess:' + sessionID, function(err, session) {
			RDB.handle(err);

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
			callback(exists);
		});
	}

	User.reset = {
		validate: function(socket, code, callback) {
			if (typeof callback !== 'function') callback = undefined;

			RDB.get('reset:' + code + ':uid', function(err, uid) {
				RDB.handle(err);

				if (uid !== null) {
					RDB.get('reset:' + code + ':expiry', function(err, expiry) {
						RDB.handle(err);

						if (expiry >= +new Date()/1000|0) {
							if (!callback) socket.emit('user:reset.valid', { valid: true });
							else callback(true);
						} else {
							// Expired, delete from db
							RDB.del('reset:' + code + ':uid');
							RDB.del('reset:' + code + ':expiry');
							if (!callback) socket.emit('user:reset.valid', { valid: false });
							else callback(false);
						}
					});
				} else {
					if (!callback) socket.emit('user:reset.valid', { valid: false });
					else callback(false);
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
						RDB.handle(err);

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
				if (typeof callback !== 'function') socket.emit('user.email.exists', { exists: exists });
				else callback(exists);
			});
		},
		confirm: function(code, callback) {
			RDB.get('confirm:' + code + ':email', function(err, email) {
				RDB.handle(err);

				if (email !== null) {
					RDB.set('email:' + email + ':confirm', true);
					RDB.del('confirm:' + code + ':email');
					callback({
						status: 'ok'
					});
				} else {
					callback({
						status: 'not_ok'
					});
				}
			});
		}
	}

	User.active = {
		get_record : function(socket) {
			RDB.mget(['global:active_user_record', 'global:active_user_record_date'], function(err, data) {
				RDB.handle(err);
				socket.emit('api:user.active.get_record', {record: data[0], timestamp: data[1]});
			});
		},

		get: function(callback) {
			function user_record(total) {
				RDB.get('global:active_user_record', function(err, record) {
					RDB.handle(err);

					if (total > record) {
						RDB.set('global:active_user_record', total);
						RDB.set('global:active_user_record_date', new Date().getTime());
					}
				});
			}

			RDB.keys('active:*', function(err, active) {
				RDB.handle(err);

				var	returnObj = {
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
}(exports));