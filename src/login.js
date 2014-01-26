var user = require('./user'),
	bcrypt = require('bcrypt'),
	db = require('./database'),
	path = require('path'),
	winston = require('winston'),
	utils = require('./../public/src/utils');

(function(Login) {

	Login.loginViaLocal = function(username, password, next) {
		if (!username || !password) {
			return next({
				status: 'error',
				message: 'invalid-user'
			});
		} else {

			var userslug = utils.slugify(username);

			user.getUidByUserslug(userslug, function(err, uid) {

				if (err) {
					return next(new Error('redis-error'));
				} else if (uid == null) {
					return next(new Error('invalid-user'));
				}

				user.getUserFields(uid, ['password', 'banned'], function(err, userData) {
					if (err) return next(err);

					if (userData.banned && parseInt(userData.banned, 10) === 1) {
						return next({
							status: "error",
							message: "user-banned"
						});
					}

					bcrypt.compare(password, userData.password, function(err, res) {
						if (err) {
							winston.err(err.message);
							next(new Error('bcrypt compare error'));
							return;
						}

						if (res) {
							next(null, {
								user: {
									uid: uid
								}
							});
						} else {
							next(new Error('invalid-password'));
						}
					});
				});
			});
		}
	}

	Login.loginViaGoogle = function(gplusid, handle, email, callback) {
		user.getUidByGoogleId(gplusid, function(err, uid) {
			if(err) {
				return callback(err);
			}

			if (uid !== null) {
				// Existing User
				callback(null, {
					uid: uid
				});
			} else {
				// New User
				var success = function(uid) {
					// Save google-specific information to the user
					user.setUserField(uid, 'gplusid', gplusid);
					db.setObjectField('gplusid:uid', gplusid, uid);
					callback(null, {
						uid: uid
					});
				};

				user.getUidByEmail(email, function(err, uid) {
					if(err) {
						return callback(err);
					}

					if (!uid) {
						user.create({username: handle, email: email}, function(err, uid) {
							if(err) {
								return callback(err);
							}

							success(uid);
						});
					} else {
						success(uid); // Existing account -- merge
					}
				});
			}
		});
	};

}(exports));
