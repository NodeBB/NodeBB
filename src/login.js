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
}(exports));
