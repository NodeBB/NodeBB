'use strict';

var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var Password = require('../password');

module.exports = function (User) {
	User.hashPassword = function (password, callback) {
		if (!password) {
			return callback(null, password);
		}

		Password.hash(nconf.get('bcrypt_rounds') || 12, password, callback);
	};

	User.isPasswordCorrect = function (uid, password, ip, callback) {
		password = password || '';
		var hashedPassword;
		async.waterfall([
			function (next) {
				db.getObjectField('user:' + uid, 'password', next);
			},
			function (_hashedPassword, next) {
				hashedPassword = _hashedPassword;
				if (!hashedPassword) {
					// Non-existant user, submit fake hash for comparison
					hashedPassword = '';
				}

				User.isPasswordValid(password, 0, next);
			},
			async.apply(User.auth.logAttempt, uid, ip),
			function (next) {
				Password.compare(password, hashedPassword, next);
			},
			function (ok, next) {
				if (ok) {
					User.auth.clearLoginAttempts(uid);
				}
				next(null, ok);
			},
		], callback);
	};

	User.hasPassword = function (uid, callback) {
		db.getObjectField('user:' + uid, 'password', function (err, hashedPassword) {
			callback(err, !!hashedPassword);
		});
	};
};
