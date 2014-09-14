'use strict';

var async = require('async'),
	db = require('../database'),
	meta = require('../meta');

module.exports = function(User) {
	User.auth = {};

	User.auth.logAttempt = function(uid, callback) {
		db.exists('lockout:' + uid, function(err, exists) {
			if (err) {
				return callback(err);
			}

			if (exists) {
				return callback(new Error('[[error:account-locked]]'));
			}

			db.increment('loginAttempts:' + uid, function(err, attempts) {
				if (err) {
					return callback(err);
				}

				if ((meta.config.loginAttempts || 5) < attempts) {
					// Lock out the account
					db.set('lockout:' + uid, '', function(err) {
						if (err) {
							return callback(err);
						}
						db.delete('loginAttempts:' + uid);
						db.pexpire('lockout:' + uid, 1000 * 60 * (meta.config.lockoutDuration || 60));
						callback(new Error('account-locked'));
					});
				} else {
					db.pexpire('loginAttempts:' + uid, 1000 * 60 * 60);
					callback();
				}
			});
		});
	};

	User.auth.clearLoginAttempts = function(uid) {
		db.delete('loginAttempts:' + uid);
	};

	User.auth.resetLockout = function(uid, callback) {
		async.parallel([
			async.apply(db.delete, 'loginAttempts:' + uid),
			async.apply(db.delete, 'lockout:' + uid)
		], callback);
	}
};