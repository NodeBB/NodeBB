
'use strict';

const _ = require('lodash');
const validator = require('validator');
const winston = require('winston');

const utils = require('../utils');
const slugify = require('../slugify');
const meta = require('../meta');
const db = require('../database');
const groups = require('../groups');
const plugins = require('../plugins');

module.exports = function (User) {
	User.updateProfile = async function (uid, data, extraFields) {
		let fields = [
			'username', 'email', 'fullname', 'website', 'location',
			'groupTitle', 'birthday', 'signature', 'aboutme',
		];
		if (Array.isArray(extraFields)) {
			fields = _.uniq(fields.concat(extraFields));
		}
		if (!data.uid) {
			throw new Error('[[error:invalid-update-uid]]');
		}
		const updateUid = data.uid;

		const result = await plugins.hooks.fire('filter:user.updateProfile', {
			uid: uid,
			data: data,
			fields: fields,
		});
		fields = result.fields;
		data = result.data;

		await validateData(uid, data);

		const oldData = await User.getUserFields(updateUid, fields);
		const updateData = {};
		await Promise.all(fields.map(async (field) => {
			if (!(data[field] !== undefined && typeof data[field] === 'string')) {
				return;
			}

			data[field] = data[field].trim();

			if (field === 'email') {
				return await updateEmail(updateUid, data.email);
			} else if (field === 'username') {
				return await updateUsername(updateUid, data.username, uid);
			} else if (field === 'fullname') {
				return await updateFullname(updateUid, data.fullname);
			}
			updateData[field] = data[field];
		}));

		if (Object.keys(updateData).length) {
			await User.setUserFields(updateUid, updateData);
		}

		plugins.hooks.fire('action:user.updateProfile', {
			uid: uid,
			data: data,
			fields: fields,
			oldData: oldData,
		});

		return await User.getUserFields(updateUid, [
			'email', 'username', 'userslug',
			'picture', 'icon:text', 'icon:bgColor',
		]);
	};

	async function validateData(callerUid, data) {
		await isEmailValid(data);
		await isUsernameAvailable(data, data.uid);
		await isWebsiteValid(callerUid, data);
		await isAboutMeValid(callerUid, data);
		await isSignatureValid(callerUid, data);
		isFullnameValid(data);
		isLocationValid(data);
		isBirthdayValid(data);
		isGroupTitleValid(data);
	}

	async function isEmailValid(data) {
		if (!data.email) {
			return;
		}

		data.email = data.email.trim();
		if (!utils.isEmailValid(data.email)) {
			throw new Error('[[error:invalid-email]]');
		}
	}

	async function isUsernameAvailable(data, uid) {
		if (!data.username) {
			return;
		}
		data.username = data.username.trim();

		let userData;
		if (uid) {
			userData = await User.getUserFields(uid, ['username', 'userslug']);
			if (userData.username === data.username) {
				return;
			}
		}

		if (data.username.length < meta.config.minimumUsernameLength) {
			throw new Error('[[error:username-too-short]]');
		}

		if (data.username.length > meta.config.maximumUsernameLength) {
			throw new Error('[[error:username-too-long]]');
		}

		const userslug = slugify(data.username);
		if (!utils.isUserNameValid(data.username) || !userslug) {
			throw new Error('[[error:invalid-username]]');
		}

		if (uid && userslug === userData.userslug) {
			return;
		}
		const exists = await User.existsBySlug(userslug);
		if (exists) {
			throw new Error('[[error:username-taken]]');
		}

		const { error } = await plugins.hooks.fire('filter:username.check', {
			username: data.username,
			error: undefined,
		});
		if (error) {
			throw error;
		}
	}
	User.checkUsername = async username => isUsernameAvailable({ username });

	async function isWebsiteValid(callerUid, data) {
		if (!data.website) {
			return;
		}
		if (data.website.length > 255) {
			throw new Error('[[error:invalid-website]]');
		}
		await User.checkMinReputation(callerUid, data.uid, 'min:rep:website');
	}

	async function isAboutMeValid(callerUid, data) {
		if (!data.aboutme) {
			return;
		}
		if (data.aboutme !== undefined && data.aboutme.length > meta.config.maximumAboutMeLength) {
			throw new Error(`[[error:about-me-too-long, ${meta.config.maximumAboutMeLength}]]`);
		}

		await User.checkMinReputation(callerUid, data.uid, 'min:rep:aboutme');
	}

	async function isSignatureValid(callerUid, data) {
		if (!data.signature) {
			return;
		}
		const signature = data.signature.replace(/\r\n/g, '\n');
		if (signature.length > meta.config.maximumSignatureLength) {
			throw new Error(`[[error:signature-too-long, ${meta.config.maximumSignatureLength}]]`);
		}
		await User.checkMinReputation(callerUid, data.uid, 'min:rep:signature');
	}

	function isFullnameValid(data) {
		if (data.fullname && (validator.isURL(data.fullname) || data.fullname.length > 255)) {
			throw new Error('[[error:invalid-fullname]]');
		}
	}

	function isLocationValid(data) {
		if (data.location && (validator.isURL(data.location) || data.location.length > 255)) {
			throw new Error('[[error:invalid-location]]');
		}
	}

	function isBirthdayValid(data) {
		if (!data.birthday) {
			return;
		}

		const result = new Date(data.birthday);
		if (result && result.toString() === 'Invalid Date') {
			throw new Error('[[error:invalid-birthday]]');
		}
	}

	function isGroupTitleValid(data) {
		function checkTitle(title) {
			if (title === 'registered-users' || groups.isPrivilegeGroup(title)) {
				throw new Error('[[error:invalid-group-title]]');
			}
		}
		if (!data.groupTitle) {
			return;
		}
		let groupTitles = [];
		if (validator.isJSON(data.groupTitle)) {
			groupTitles = JSON.parse(data.groupTitle);
			if (!Array.isArray(groupTitles)) {
				throw new Error('[[error:invalid-group-title]]');
			}
			groupTitles.forEach(title => checkTitle(title));
		} else {
			groupTitles = [data.groupTitle];
			checkTitle(data.groupTitle);
		}
		if (!meta.config.allowMultipleBadges && groupTitles.length > 1) {
			data.groupTitle = JSON.stringify(groupTitles[0]);
		}
	}

	User.checkMinReputation = async function (callerUid, uid, setting) {
		const isSelf = parseInt(callerUid, 10) === parseInt(uid, 10);
		if (!isSelf || meta.config['reputation:disabled']) {
			return;
		}
		const reputation = await User.getUserField(uid, 'reputation');
		if (reputation < meta.config[setting]) {
			throw new Error(`[[error:not-enough-reputation-${setting.replace(/:/g, '-')}, ${meta.config[setting]}]]`);
		}
	};

	async function updateEmail(uid, newEmail) {
		let oldEmail = await db.getObjectField(`user:${uid}`, 'email');
		oldEmail = oldEmail || '';
		if (oldEmail === newEmail) {
			return;
		}

		// 👉 Looking for email change logic? src/user/email.js (UserEmail.confirmByUid)
		if (newEmail) {
			await User.email.sendValidationEmail(uid, {
				email: newEmail,
				force: 1,
			}).catch(err => winston.error(`[user.create] Validation email failed to send\n[emailer.send] ${err.stack}`));
		}
	}

	async function updateUsername(uid, newUsername, callerUid) {
		if (!newUsername) {
			return;
		}
		const userData = await db.getObjectFields(`user:${uid}`, ['username', 'userslug']);
		if (userData.username === newUsername) {
			return;
		}
		const newUserslug = slugify(newUsername);
		const now = Date.now();
		await Promise.all([
			updateUidMapping('username', uid, newUsername, userData.username),
			updateUidMapping('userslug', uid, newUserslug, userData.userslug),
			db.sortedSetAdd(`user:${uid}:usernames`, now, `${newUsername}:${now}:${callerUid}`),
		]);
		await db.sortedSetRemove('username:sorted', `${userData.username.toLowerCase()}:${uid}`);
		await db.sortedSetAdd('username:sorted', 0, `${newUsername.toLowerCase()}:${uid}`);
	}

	async function updateUidMapping(field, uid, value, oldValue) {
		if (value === oldValue) {
			return;
		}
		await db.sortedSetRemove(`${field}:uid`, oldValue);
		await User.setUserField(uid, field, value);
		if (value) {
			await db.sortedSetAdd(`${field}:uid`, uid, value);
		}
	}

	async function updateFullname(uid, newFullname) {
		const fullname = await db.getObjectField(`user:${uid}`, 'fullname');
		await updateUidMapping('fullname', uid, newFullname, fullname);
		if (newFullname !== fullname) {
			if (fullname) {
				await db.sortedSetRemove('fullname:sorted', `${fullname.toLowerCase()}:${uid}`);
			}
			if (newFullname) {
				await db.sortedSetAdd('fullname:sorted', 0, `${newFullname.toLowerCase()}:${uid}`);
			}
		}
	}

	User.changePassword = async function (uid, data) {
		if (uid <= 0 || !data || !data.uid) {
			throw new Error('[[error:invalid-uid]]');
		}
		User.isPasswordValid(data.newPassword);
		const [isAdmin, hasPassword] = await Promise.all([
			User.isAdministrator(uid),
			User.hasPassword(uid),
		]);

		if (meta.config['password:disableEdit'] && !isAdmin) {
			throw new Error('[[error:no-privileges]]');
		}

		const isSelf = parseInt(uid, 10) === parseInt(data.uid, 10);

		if (!isAdmin && !isSelf) {
			throw new Error('[[user:change-password-error-privileges]]');
		}

		await plugins.hooks.fire('filter:password.check', { password: data.newPassword, uid: data.uid });

		if (isSelf && hasPassword) {
			const correct = await User.isPasswordCorrect(data.uid, data.currentPassword, data.ip);
			if (!correct) {
				throw new Error('[[user:change-password-error-wrong-current]]');
			}
		}

		const hashedPassword = await User.hashPassword(data.newPassword);
		await Promise.all([
			User.setUserFields(data.uid, {
				password: hashedPassword,
				'password:shaWrapped': 1,
				rss_token: utils.generateUUID(),
			}),
			User.reset.cleanByUid(data.uid),
			User.reset.updateExpiry(data.uid),
			User.auth.revokeAllSessions(data.uid),
			User.email.expireValidation(data.uid),
		]);

		plugins.hooks.fire('action:password.change', { uid: uid, targetUid: data.uid });
	};
};
