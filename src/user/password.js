'use strict';


const nconf = require('nconf');

const db = require('../database');
const Password = require('../password');

module.exports = function (User) {
	User.hashPassword = async function (password) {
		if (!password) {
			return password;
		}

		return await Password.hash(nconf.get('bcrypt_rounds') || 12, password);
	};

	User.isPasswordCorrect = async function (uid, password, ip) {
		password = password || '';
		var hashedPassword = await db.getObjectField('user:' + uid, 'password');
		if (!hashedPassword) {
			// Non-existant user, submit fake hash for comparison
			hashedPassword = '';
		}

		User.isPasswordValid(password, 0);
		await User.auth.logAttempt(uid, ip);
		const ok = await Password.compare(password, hashedPassword);
		if (ok) {
			User.auth.clearLoginAttempts(uid);
		}
		return ok;
	};

	User.hasPassword = async function (uid) {
		const hashedPassword = await db.getObjectField('user:' + uid, 'password');
		return !!hashedPassword;
	};
};
