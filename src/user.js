var	config = require('../config.js'),
	utils = require('./utils.js'),
	RDB = require('./redis.js'),
	crypto = require('crypto'),
	emailjs = require('emailjs'),
	emailjsServer = emailjs.server.connect(config.mailer),
	bcrypt = require('bcrypt');

(function(User) {


	User.getUserField = function(uid, field, callback) {
		RDB.db.hget(String(uid), field, function(err, data){
			if(err === null)
				callback(data);
			else
				console.log(err);
		});
	}
	
	User.getUserFields = function(uid, fields, callback) {
		RDB.db.hmget(String(uid), fields, function(err, data){
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

		RDB.db.hgetall(String(uid), function(err, data){
			if(err === null)
			{
				if(data && data['password'])
					delete data['password'];
				callback(data);
			}
			else
				console.log(err);
		});
	}

	User.setUserField = function(uid, field, value) {
		RDB.db.hset(String(uid),	field, value);				
	}

	User.loginViaLocal = function(username, password, next) {

		if (!username || !password) {
			return next({
				status: 'error',
				message: 'invalid-user'
			});
		} else {
			RDB.get('username:' + username + ':uid', function(uid) {
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

		if(!username) {
			console.log("invalid registration data! username ["+username+"], password ["+password+"], email ["+email+"]");
			return;
		}
	
		// TODO : check if username email is unique!! -baris
	

		RDB.incr('global:next_user_id', function(uid) {
			
			console.log("Registering uid : " + uid);

			User.hashPassword(password, function(hash) {

				RDB.db.hmset(String(uid), {
					'username' : username,
					'email' : email,
					'joindate' : new Date().getTime(),
					'password' : hash,
					'picture' : User.createGravatarURLFromEmail(email),
					'reputation': 0,
					'postcount': 0
				});
				
				RDB.set('username:' + username + ':uid', uid);
				RDB.set('email:' + email +':uid', uid);			
				
				if(email)
					User.sendConfirmationEmail(email);
			
				RDB.incr('user:count', function(count) {
					io.sockets.emit('user.count', {count: count});
				});

				RDB.lpush('user:users', username);
				io.sockets.emit('user.latest', {username: username});

				callback(null, uid);
				
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
		RDB.set('email:' + email + ':confirm', confirm_code, 60*60*2);
		RDB.set('confirm:' + confirm_code + ':email', email, 60*60*2);	// Expire after 2 hours

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


	User.exists = function(username, callback) {
		User.get_uid_by_username(username, function(exists) {
			exists = !!exists;

			if (callback) 
				callback(exists);
		});
	};
	
	User.count = function(socket) {
		RDB.get('user:count', function(count) {
			socket.emit('user.count', {count: (count === null) ? 0 : count});
		});
	};
	
	User.latest = function(socket) {
		RDB.lrange('user:users', 0, 0, function(username) {
			socket.emit('user.latest', {username: username});
		});	
	}

	User.get_uid_by_username = function(username, callback) {
		RDB.get('username:' + username + ':uid', callback);
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
		RDB.get('email:' + email + ':uid', callback)
	};

	User.get_uid_by_session = function(session, callback) {
		RDB.get('sess:' + session + ':uid', callback);
	};

	User.get_uid_by_twitter_id = function(twid, callback) {
		RDB.get('twid:' + twid + ':uid', function(uid) {
			callback(uid);
		});
	}

	User.get_uid_by_google_id = function(gplusid, callback) {
		RDB.get('gplusid:' + gplusid + ':uid', function(uid) {
			callback(uid);
		});	
	}

	User.get_uid_by_fbid = function(fbid, callback) {
		RDB.get('fbid:' + fbid + ':uid', function(uid) {
			callback(uid);
		});	
	}

	User.session_ping = function(sessionID, uid) {
		// Start, replace, or extend a session
		RDB.get('sess:' + sessionID, function(session) {
			RDB.set('sess:' + sessionID + ':uid', uid, 60*60*24*14);	// Login valid for two weeks
			RDB.set('uid:' + uid + ':session', sessionID, 60*60*24*14);
		});
	}

	User.reset = {
		validate: function(socket, code, callback) {
			if (typeof callback !== 'function') callback = undefined;

			RDB.get('reset:' + code + ':uid', function(uid) {
				if (uid !== null) {
					RDB.get('reset:' + code + ':expiry', function(expiry) {
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
					RDB.get('reset:' + code + ':uid', function(uid) {

						RDB.db.hset(String(uid), 'password', password);
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
			RDB.get('confirm:' + code + ':email', function(email) {
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
			RDB.mget(['global:active_user_record', 'global:active_user_record_date'], function(data) {
				socket.emit('api:user.active.get_record', {record: data[0], timestamp: data[1]});
			});
		},

		get: function(callback) {
			function user_record(total) {
				RDB.get('global:active_user_record', function(record) {
					if (total > record) {
						RDB.set('global:active_user_record', total);
						RDB.set('global:active_user_record_date', new Date().getTime());
					}
				});
			}

			RDB.keys('active:*', function(active) {
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

					RDB.mget(keys, function(uids) {
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
			RDB.set('active:' + sessionID, '', 60*10);	// Active state persists for 10 minutes
			this.get();
		}
	}
}(exports));