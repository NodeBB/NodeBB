'use strict';

const zxcvbn = require('zxcvbn');
const db = require('../database');
const utils = require('../utils');
const slugify = require('../slugify');
const plugins = require('../plugins');
const groups = require('../groups');
const meta = require('../meta');

module.exports = function (User) {
	User.create = async function (data) {
		data.username = data.username.trim();
		data.userslug = slugify(data.username);
		if (data.email !== undefined) {
			data.email = String(data.email).trim();
		}

		try {
			await lock(data.username, '[[error:username-taken]]');
			if (data.email) {
				await lock(data.email, '[[error:email-taken]]');
			}

			await User.isDataValid(data);

			return await create(data);
		} finally {
			await db.deleteObjectFields('locks', [data.username, data.email]);
		}
	};

	async function lock(value, error) {
		const count = await db.incrObjectField('locks', value);
		if (count > 1) {
			throw new Error(error);
		}
	}

	async function create(data) {
		const timestamp = data.timestamp || Date.now();

		let userData = {
			username: data.username,
			userslug: data.userslug,
			email: data.email || '',
			joindate: timestamp,
			lastonline: timestamp,
			status: 'online',
		};
		['picture', 'fullname', 'location', 'birthday'].forEach((field) => {
			if (data[field]) {
				userData[field] = data[field];
			}
		});
		if (data.gdpr_consent === true) {
			userData.gdpr_consent = 1;
		}
		if (data.acceptTos === true) {
			userData.acceptTos = 1;
		}

		const renamedUsername = await User.uniqueUsername(userData);
		const userNameChanged = !!renamedUsername;
		if (userNameChanged) {
			userData.username = renamedUsername;
			userData.userslug = slugify(renamedUsername);
		}

		const results = await plugins.fireHook('filter:user.create', { user: userData, data: data });
		userData = results.user;

		const uid = await db.incrObjectField('global', 'nextUid');
		userData.uid = uid;

		await db.setObject('user:' + uid, userData);

		const bulkAdd = [
			['username:uid', userData.uid, userData.username],
			['user:' + userData.uid + ':usernames', timestamp, userData.username + ':' + timestamp],
			['username:sorted', 0, userData.username.toLowerCase() + ':' + userData.uid],
			['userslug:uid', userData.uid, userData.userslug],
			['users:joindate', timestamp, userData.uid],
			['users:online', timestamp, userData.uid],
			['users:postcount', 0, userData.uid],
			['users:reputation', 0, userData.uid],
		];

		if (userData.email) {
			bulkAdd.push(['email:uid', userData.uid, userData.email.toLowerCase()]);
			bulkAdd.push(['email:sorted', 0, userData.email.toLowerCase() + ':' + userData.uid]);
			bulkAdd.push(['user:' + userData.uid + ':emails', timestamp, userData.email + ':' + timestamp]);
		}

		if (userData.fullname) {
			bulkAdd.push(['fullname:sorted', 0, userData.fullname.toLowerCase() + ':' + userData.uid]);
		}

		const groupsToJoin = ['registered-users'].concat(
			parseInt(userData.uid, 10) !== 1 ?
				'unverified-users' : 'verified-users'
		);

		await Promise.all([
			db.incrObjectField('global', 'userCount'),
			db.sortedSetAddBulk(bulkAdd),
			groups.join(groupsToJoin, userData.uid),
			User.notifications.sendWelcomeNotification(userData.uid),
			storePassword(userData.uid, data.password),
			User.updateDigestSetting(userData.uid, meta.config.dailyDigestFreq),
		]);

		if (userData.email && userData.uid > 1 && meta.config.requireEmailConfirmation) {
			User.email.sendValidationEmail(userData.uid, {
				email: userData.email,
			});
		}
		if (userNameChanged) {
			await User.notifications.sendNameChangeNotification(userData.uid, userData.username);
		}
		plugins.fireHook('action:user.create', { user: userData, data: data });
		return userData.uid;
	}

	async function storePassword(uid, password) {
		if (!password) {
			return;
		}
		const hash = await User.hashPassword(password);
		await Promise.all([
			User.setUserFields(uid, {
				password: hash,
				'password:shaWrapped': 1,
			}),
			User.reset.updateExpiry(uid),
		]);
	}

	User.isDataValid = async function (userData) {
		if (userData.email && !utils.isEmailValid(userData.email)) {
			throw new Error('[[error:invalid-email]]');
		}

		if (!utils.isUserNameValid(userData.username) || !userData.userslug) {
			throw new Error('[[error:invalid-username, ' + userData.username + ']]');
		}

		if (userData.password) {
			User.isPasswordValid(userData.password);
		}

		if (userData.email) {
			const available = await User.email.available(userData.email);
			if (!available) {
				throw new Error('[[error:email-taken]]');
			}
		}
	};

	User.isPasswordValid = function (password, minStrength) {
		minStrength = (minStrength || minStrength === 0) ? minStrength : meta.config.minimumPasswordStrength;

		// Sanity checks: Checks if defined and is string
		if (!password || !utils.isPasswordValid(password)) {
			throw new Error('[[error:invalid-password]]');
		}

		if (password.length < meta.config.minimumPasswordLength) {
			throw new Error('[[reset_password:password_too_short]]');
		}

		if (password.length > 512) {
			throw new Error('[[error:password-too-long]]');
		}

		const strength = zxcvbn(password);
		if (strength.score < minStrength) {
			throw new Error('[[user:weak_password]]');
		}
	};

	User.uniqueUsername = async function (userData) {
		let numTries = 0;
		let username = userData.username;
		while (true) {
			/* eslint-disable no-await-in-loop */
			const exists = await meta.userOrGroupExists(username);
			if (!exists) {
				return numTries ? username : null;
			}
			username = userData.username + ' ' + numTries.toString(32);
			numTries += 1;
		}
	};
};
