var	config = require('../config.js'),
	utils = require('../utils.js'),
	RDB = require('./redis.js'),
	emailjs = require('emailjs'),
	emailjsServer = emailjs.server.connect(config.mailer);

(function(User) {

	User.login = function(user) {
		if (user.username == null || user.password == null) {
			return global.socket.emit('user.login', {'status': 0, 'message': 'Missing fields'});
		}

		RDB.get('username:' + user.username + ':uid', function(uid) {
			if (uid == null) {
				return global.socket.emit('user.login', {'status': 0, 'message': 'Username does not exist.'});
			}

			RDB.get('uid:' + uid + ':password', function(password) {
				if (user.password != password) {
					return global.socket.emit('user.login', {'status': 0, 'message': 'Incorrect username / password combination.'});
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

					global.uid = uid;

					return global.socket.emit('user.login', {'status': 1, 'message': 'Logged in!'});
				}
			});
		});
	};

	User.logout = function(sessionID, callback) {
		User.get_uid_by_session(sessionID, function(uid) {
			if (uid) {
				RDB.del('sess:' + sessionID + ':uid');
				RDB.del('uid:' + uid + ':session');
				callback(true);
			} else callback(false);
		});
	}

	User.create = function(username, password, email) {
		if (username == null || password == null) {
			return; global.socket.emit('user.create', {'status': 0, 'message': 'Missing fields'});
		}


		User.exists(username, function(exists) {
			if (exists) {
				return;
			}

			RDB.incr('global:next_user_id', function(uid) {
				RDB.set('username:' + username + ':uid', uid);
				RDB.set('uid:' + uid + ':username', username);
				RDB.set('uid:' + uid + ':password', password);
				RDB.set('uid:' + uid + ':email', email);
				RDB.set('email:' + email, uid);
				
				RDB.incr('user:count', function(count) {
					io.sockets.emit('user.count', {count: count});
				});

				RDB.lpush('user:users', username);
				io.sockets.emit('user.latest', {username: username});

				global.socket.emit('user.create', {'status': 1});

				global.socket.emit('event:alert', {
					title: 'Thank you for registering',
					message: 'You have successfully registered - welcome to nodebb!',
					type: 'notify',
					timeout: 2000
				});
			});
		});
	};


	User.exists = function(username, callback) {
		User.get_uid_by_username(username, function(exists) {
			exists = !!exists;
			global.socket.emit('user.exists', {exists: exists})

			if (callback) {
				callback(exists);
			}
		});
	};
	User.count = function() {
		RDB.get('user:count', function(count) {
			global.socket.emit('user.count', {count: (count === null) ? 0 : count});
		});
	};
	User.latest = function() {
		RDB.lrange('user:users', 0, 0, function(username) {
			global.socket.emit('user.latest', {username: username});
		});	
	}

	User.get_uid_by_username = function(username, callback) {
		RDB.get('username:' + username + ':uid', callback);
	};

	User.get_uid_by_email = function(email, callback) {
		RDB.get('email:' + email, callback)
	};

	User.get_uid_by_session = function(session, callback) {
		RDB.get('sess:' + session + ':uid', callback);
	};

	User.reset = {
		validate: function(code, callback) {
			if (typeof callback !== 'function') callback = undefined;

			RDB.get('reset:' + code + ':uid', function(uid) {
				if (uid !== null) {
					RDB.get('reset:' + code + ':expiry', function(expiry) {
						if (expiry >= +new Date()/1000|0) {
							if (!callback) global.socket.emit('user:reset.valid', { valid: true });
							else callback(true);
						} else {
							// Expired, delete from db
							RDB.del('reset:' + code + ':uid');
							RDB.del('reset:' + code + ':expiry');
							if (!callback) global.socket.emit('user:reset.valid', { valid: false });
							else callback(false);
						}
					});
				} else {
					if (!callback) global.socket.emit('user:reset.valid', { valid: false });
					else callback(false);
				}
			});
		},
		send: function(email) {
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
							global.socket.emit('user.send_reset', {
								status: "ok",
								message: "code-sent",
								email: email
							});
						} else {
							global.socket.emit('user.send_reset', {
								status: "error",
								message: "send-failed"
							});
							throw new Error(err);
						}
					});
				} else {
					global.socket.emit('user.send_reset', {
						status: "error",
						message: "invalid-email",
						email: email
					});
				}
			});
		},
		commit: function(code, password) {
			this.validate(code, function(validated) {
				if (validated) {
					RDB.get('reset:' + code + ':uid', function(uid) {
						RDB.set('uid:' + uid + ':password', password);
						RDB.del('reset:' + code + ':uid');
						RDB.del('reset:' + code + ':expiry');

						global.socket.emit('user:reset.commit', { status: 'ok' });
					});
				}
			});
		}
	}

	User.email = {
		exists: function(email, callback) {
			User.get_uid_by_email(email, function(exists) {
				exists = !!exists;
				if (typeof callback !== 'function') global.socket.emit('user.email.exists', { exists: exists });
				else callback(exists);
			});
		}
	}

	User.active = {
		get: function(callback) {
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

						if (callback === undefined) {
							global.socket.emit('api:user.active.get', returnObj)
						} else {
							callback(returnObj);
						}
					});
				} else {
					global.socket.emit('api:user.active.get', returnObj)
				}
			});
		},
		register: function(sessionID) {
			RDB.set('active:' + sessionID, '', 60*10);	// Active state persists for 10 minutes
		}
	}
}(exports));