var	config = require('../config.js'),
	utils = require('./utils.js'),
	RDB = require('./redis.js'),
	crypto = require('crypto'),
	emailjs = require('emailjs'),
	emailjsServer = emailjs.server.connect(config.mailer),
	bcrypt = require('bcrypt');

(function(User) {

	User.get = function(socket, uid, fields) {
		if (uid > 0) {
			var	keys = [],
				returnData = {
					uid: uid
				},
				removeEmail = false;

			if (!(fields instanceof Array)) fields = ['username', 'email'];
			if (fields.indexOf('picture') !== -1 && fields.indexOf('email') === -1) {
				fields.push('email');
				removeEmail = true;
			}

			for(var f=0,numFields=fields.length;f<numFields;f++) {
				keys.push('uid:' + uid + ':' + fields[f]);
			}

			RDB.mget(keys, function(data) {
				for(var x=0,numData=data.length;x<numData;x++) {
					returnData[fields[x]] = data[x];
				}
				
				if (returnData.picture !== undefined) {
					var	md5sum = crypto.createHash('md5');
					if (!returnData.email) returnData.email = '';
					md5sum.update(returnData.email.toLowerCase());
					returnData.picture = 'http://www.gravatar.com/avatar/' + md5sum.digest('hex') + '?s=24';
					if (removeEmail) delete returnData.email;
				}
				socket.emit('api:user.get', returnData);
			});
		} else {
			socket.emit('api:user.get', {
				username: "Anonymous User",
				email: '',
				picture: 'http://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=24'
			});
		}
	}


	User.get_gravatars_by_uids = function(uids, size, callback) {
		var keys = [];
		for (var i = 0, ii= uids.length; i<ii; i++) {
			keys.push('uid:' + uids[i] + ':email');
		}

		var gravatars = [];
		

		RDB.mget(keys, function(data) {
			for (var i=0, ii=data.length; i<ii; i++) {
				if (!data[i]) {
					gravatars.push("http://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=" + size);
				} else {
					var	md5sum = crypto.createHash('md5');
					md5sum.update((data[i]).toLowerCase());
					gravatars.push('http://www.gravatar.com/avatar/' + md5sum.digest('hex') + '?s=' + size);	
				}
				
			}

			callback(gravatars);
		});
		
	};

	User.login = function(socket, user) {
		if (user.username == null || user.password == null) {
			return socket.emit('user.login', {'status': 0, 'message': 'Missing fields'});
		}

		RDB.get('username:' + user.username + ':uid', function(uid) {
			if (uid == null) {
				return socket.emit('user.login', {'status': 0, 'message': 'Username does not exist.'});
			}

			RDB.get('uid:' + uid + ':password', function(password) {
				if (user.password != password) {
					return socket.emit('user.login', {'status': 0, 'message': 'Incorrect username / password combination.'});
				} else {
					// Start, replace, or extend a session
					RDB.get('sess:' + user.sessionID, function(session) {
						if (session !== user.sessionID) {
							RDB.set('sess:' + user.sessionID + ':uid', uid, 60*60*24*14);	// Login valid for two weeks
							RDB.set('uid:' + uid + ':session', user.sessionID, 60*60*24*14);
						} else {
							RDB.expire('sess:' + user.sessionID + ':uid', 60*60*24*14);	// Defer expiration to two weeks from now
							RDB.expire('uid:' + uid + ':session', 60*60*24*14);
						}
					});

					return socket.emit('user.login', {'status': 1, 'message': 'Logged in!'});
				}
			});
		});
	};

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

				RDB.get('uid:' + uid + ':password', function(user_password) {
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
		User.exists(null, username, function(exists) {
			if (exists) {
				return callback('user-exists', 0);
			}

			RDB.incr('global:next_user_id', function(uid) {
				RDB.set('username:' + username + ':uid', uid);
				RDB.set('uid:' + uid + ':username', username);
				if (password) {
					bcrypt.genSalt(10, function(err, salt) {
						bcrypt.hash(password, salt, function(err, hash) {
							RDB.set('uid:' + uid + ':password', hash);
						});
					});
				}
				if (email) {
					RDB.set('uid:' + uid + ':email', email);
					RDB.set('email:' + email, uid);
				}
				
				RDB.incr('user:count', function(count) {
					io.sockets.emit('user.count', {count: count});
				});

				RDB.lpush('user:users', username);
				io.sockets.emit('user.latest', {username: username});

				callback(null, uid);
			});
		});
	};


	User.exists = function(socket, username, callback) {
		User.get_uid_by_username(username, function(exists) {
			exists = !!exists;

			if (callback) callback(exists);
			else socket.emit('user.exists', {exists: exists});
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

	User.get_username_by_uid = function(uid, callback) {
		RDB.get('uid:' + uid+ ':username', callback);
	};

	User.get_usernames_by_uids = function(uids, callback) {
		var userIds = [];
		for(var i=0, ii=uids.length; i<ii; i++) {
			userIds.push('uid:' + uids[i] + ':username');
		}
		
		RDB.mget(userIds, function(data) {
			callback(data);
		});
	};

	User.get_user_postdetails = function(uids, callback) {
		var username = [],
			rep = [];

		for(var i=0, ii=uids.length; i<ii; i++) {
			username.push('uid:' + uids[i] + ':username');
			rep.push('uid:' + uids[i] + ':rep');
		}
		
		RDB.multi()
			.mget(username)
			.mget(rep)
			.exec(function(err, replies) {
				callback({
					'username': replies[0],
					'rep' : replies[1]
				});
			});
	}

	User.get_uid_by_email = function(email, callback) {
		RDB.get('email:' + email, callback)
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
						RDB.set('uid:' + uid + ':password', password);
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