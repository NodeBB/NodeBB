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

	User.isPasswordCorrect = function (uid, password, callback) {
		password = password || '';
		var hashedPassword;
		async.waterfall([
			function (next) {
				db.getObjectField('user:' + uid, 'password', next);
			},
			function (_hashedPassword, next) {
				hashedPassword = _hashedPassword;
				if (!hashedPassword) {
					return callback(null, true);
				}

				User.isPasswordValid(password, 0, next);
			},
			function (next) {
				Password.compare(password, hashedPassword, next);
			},
		], function (err, ok) {
			if (err) {
				return callback(err);
			}

			// Delay return for incorrect current password
			setTimeout(function () {
				callback(null, ok);
			}, ok ? 0 : 2500);
		});
	};

	User.hasPassword = function (uid, callback) {
		db.getObjectField('user:' + uid, 'password', function (err, hashedPassword) {
			callback(err, !!hashedPassword);
		});
	};
};
