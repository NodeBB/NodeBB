
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
const activitypub = require('../activitypub');
const tx = require('../translator');

module.exports = function (User) {
	User.updateProfile = async function (uid, data, extraFields) {
		let fields = [
			'username', 'email', 'fullname',
			'groupTitle', 'birthday', 'signature', 'aboutme',
			...await User.customFields.getKeys(),
		];
		if (Array.isArray(extraFields)) {
			fields = fields.concat(extraFields);
		}
		fields = _.uniq(fields).filter(field => !User.protectedFields.includes(field));
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
		activitypub.out.update.profile(updateUid, uid);

		return await User.getUserFields(updateUid, [
			'email', 'username', 'userslug',
			'picture', 'icon:text', 'icon:bgColor',
		]);
	};

	async function validateData(callerUid, data) {
		await isEmailValid(data);
		await isUsernameAvailable(data, data.uid);
		await isAboutMeValid(callerUid, data);
		await isSignatureValid(callerUid, data);
		isFullnameValid(data);
		isBirthdayValid(data);
		await isGroupTitleValid(data);
		await validateCustomFields(data);
	}

	async function validateCustomFields(data) {
		const fields = await User.customFields.getFields();
		const reputation = await User.getUserField(data.uid, 'reputation');

		fields.forEach((field) => {
			if (!data.hasOwnProperty(field.key)) {
				return;
			}

			const minRep = field['min:rep'] || 0;
			if (reputation < minRep && !meta.config['reputation:disabled']) {
				throw new Error(tx.compile(
					'error:not-enough-reputation-custom-field', minRep, field.name
				));
			}

			User.customFields.validate(field, data[field.key]);
		});
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

		User.checkUsernameLength(data.username);

		const userslug = slugify(data.username);
		if (!utils.isUserNameValid(data.username) || !utils.isSlugValid(userslug)) {
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

	User.checkUsernameLength = function (username) {
		if (
			!username ||
			username.length < meta.config.minimumUsernameLength ||
			slugify(username).length < meta.config.minimumUsernameLength
		) {
			throw new Error('[[error:username-too-short]]');
		}

		if (username.length > meta.config.maximumUsernameLength) {
			throw new Error('[[error:username-too-long]]');
		}
	};

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

	function isBirthdayValid(data) {
		if (!data.birthday) {
			return;
		}

		const result = new Date(data.birthday);
		if (result && result.toString() === 'Invalid Date') {
			throw new Error('[[error:invalid-birthday]]');
		}
	}

	async function isGroupTitleValid(data) {
		function checkTitle(title) {
			if (title === 'registered-users' || groups.isPrivilegeGroup(title)) {
				throw new Error('[[error:invalid-group-title]]');
			}
		}
		if (!data.groupTitle) {
			return;
		}
		let groupTitles;
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
			groupTitles = [groupTitles[0]];
		}
		// Ensure the user is actually a member of each selected group (prevents badge spoofing via the API)
		const memberships = await groups.isMemberOfGroups(data.uid, groupTitles);
		if (memberships.includes(false)) {
			throw new Error('[[error:invalid-group-title]]');
		}
	}

	User.checkMinReputation = async function (callerUid, uid, setting) {
		const isSelf = parseInt(callerUid, 10) === parseInt(uid, 10);
		if (!isSelf || meta.config['reputation:disabled']) {
			return;
		}
		if (await User.isAdminOrGlobalMod(callerUid)) {
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
		if (await User.email.isValidationPending(uid, newEmail)) {
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
		uid = String(uid);
		data.uid = String(data.uid);
		User.isPasswordValid(data.newPassword);
		const [isAdmin, isTargetAdmin, hasPassword] = await Promise.all([
			User.isAdministrator(uid),
			User.isAdministrator(data.uid),
			User.hasPassword(uid),
		]);

		if (meta.config['password:disableEdit'] && !isAdmin) {
			throw new Error('[[error:no-privileges]]');
		}

		const isSelf = uid === data.uid;
		const allowedToChange = isSelf || (isAdmin && !isTargetAdmin);
		if (!allowedToChange) {
			throw new Error('[[user:change-password-error-privileges]]');
		}

		await plugins.hooks.fire('filter:password.check', { password: data.newPassword, uid: data.uid });

		if (isSelf && hasPassword) {
			const correct = await User.isPasswordCorrect(data.uid, data.currentPassword, data.ip);
			if (!correct) {
				throw new Error('[[user:change-password-error-wrong-current]]');
			}
			if (data.currentPassword === data.newPassword) {
				throw new Error('[[user:change-password-error-same-password]]');
			}
		}

		const hashedPassword = await User.hashPassword(data.newPassword);
		await User.setUserFields(data.uid, {
			password: hashedPassword,
			'password:shaWrapped': 1,
			rss_token: utils.generateUUID(),
		}),
		await User.onPasswordChange(uid, data.uid);
	};

	User.onPasswordChange = async function (uid, targetUid) {
		await Promise.all([
			User.reset.cleanByUid(targetUid),
			User.reset.updateExpiry(targetUid),
			User.auth.revokeAllSessions(targetUid),
			User.email.expireValidation(targetUid),
		]);
		plugins.hooks.fire('action:password.change', { uid, targetUid });
	};
};
