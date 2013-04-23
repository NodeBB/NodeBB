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

				var message = emailjs.message.create({
					text:	"Hello,\n\n" +
							"We received a request to reset your password, possibly because you have forgotten it. If this is not the case, please ignore this email.\n\n" +
							"To continue with the password reset, please click on the following link:\n\n" +
							"&nbsp;&nbsp;" + config.url + 'reset/' + reset_code + "\n\n\n" +
							"Thanks!\nNodeBB",
					from: config.mailer.from,
					to: email,
					subject: 'Password Reset Requested',
					attachment: [
						{
							data:	"<p>Hello,</p>" +
									"<p>We received a request to reset your password, possibly because you have forgotten it. If this is not the case, please ignore this email.</p>" +
									"<p>To continue with the password reset, please click on the following link:</p>" +
									"<blockquote>" + config.url + 'reset/' + reset_code + "</blockquote>" +
									"<p>Thanks!<br /><strong>NodeBB</strong>",
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