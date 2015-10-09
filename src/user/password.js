'use strict';

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
		db.getObjectField('user:' + uid, 'password', function(err, hashedPassword) {
			if (err || !hashedPassword) {
				return callback(err);
			}

			Password.compare(password || '', hashedPassword, callback);
		});
	};

};