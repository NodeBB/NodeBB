var	config = require('../config.js'),
	utils = require('../utils.js'),
	RDB = require('./redis.js'),
	emailjs = require('emailjs'),
	emailjsServer = emailjs.server.connect(config.mailer);

(function(User) {
	var current_uid;

	User.login = function(user) {
		if (current_uid) {
			return global.socket.emit('user.login', {'status': 0, 'message': 'User is already logged in.'});
			
		}

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
					return global.socket.emit('user.login', {'status': 1, 'message': 'Logged in!'});
				}
			});
				
		});
				

	};


	User.create = function(username, password, email) {
		if (current_uid) {
			return; global.socket.emit('user.create', {'status': 0, 'message': 'Only anonymous users can register a new account.'});
		}

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

	User.send_reset = function(email) {
		User.get_uid_by_email(email, function(uid) {
			if (uid !== null) {
				// Generate a new reset code
				var reset_code = utils.generateUUID();
				RDB.set('user:reset:' + reset_code, uid);

				var reset_link = config.url + 'reset/' + reset_code,
					reset_email = global.templates['emails/reset'].parse({'RESET_LINK': reset_link});

				var message = emailjs.message.create({
					text:	reset_email,
					from: config.mailer.from,
					to: email,
					subject: 'Password Reset Requested',
					attachment: [
						{
							data:	reset_email,
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
					}
					else throw new Error(err);
				});
			} else {
				global.socket.emit('user.send_reset', {
					status: "error",
					message: "invalid-email",
					email: email
				});
			}
		});
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
}(exports));