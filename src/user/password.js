'use strict';

var async = require('async');
var nconf = require('nconf');

var db = require('../database');
var Password = require('../password');

module.exports = function(User) {

	User.hashPassword = function(password, callback) {
		if (!password) {
			return callback(null, password);
		}

		Password.hash(nconf.get('bcrypt_rounds') || 12, password, callback);
	};

	User.isPasswordCorrect = function(uid, password, callback) {
		password = password || '';
		async.waterfall([
			function (next) {
				db.getObjectField('user:' + uid, 'password', next);
			},
			function (hashedPassword, next) {
				if (!hashedPassword) {
					return callback(null, true);
				}

				User.isPasswordValid(password, function(err) {
					if (err) {
						return next(err);
					}

					Password.compare(password, hashedPassword, next);
				});
			}
		], callback);
	};

	User.hasPassword = function(uid, callback) {
		db.getObjectField('user:' + uid, 'password', function(err, hashedPassword) {
			callback(err, !!hashedPassword);
		});
	};

};