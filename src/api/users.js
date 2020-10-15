'use strict';

const user = require('../user');
const meta = require('../meta');
const privileges = require('../privileges');
const events = require('../events');

const usersAPI = module.exports;

usersAPI.create = async function (caller, data) {
	const uid = await user.create(data);
	return await user.getUserData(uid);
};

usersAPI.update = async function (caller, data) {
	const targetUid = caller.params ? caller.params.uid : data.uid;

	const oldUserData = await user.getUserFields(targetUid, ['email', 'username']);
	if (!oldUserData || !oldUserData.username) {
		throw new Error('[[error:invalid-data]]');
	}

	const [isAdminOrGlobalMod, canEdit, passwordMatch] = await Promise.all([
		user.isAdminOrGlobalMod(caller.uid),
		privileges.users.canEdit(caller.uid, targetUid),
		data.password ? user.isPasswordCorrect(targetUid, data.password, caller.ip) : false,
	]);

	// Changing own email/username requires password confirmation
	if (['email', 'username'].some(prop => Object.keys(data).includes(prop)) && !isAdminOrGlobalMod && caller.uid === targetUid && !passwordMatch) {
		throw new Error('[[error:invalid-password]]');
	}

	if (!canEdit) {
		throw new Error('[[error:no-privileges]]');
	}

	if (!isAdminOrGlobalMod && meta.config['username:disableEdit']) {
		data.username = oldUserData.username;
	}

	if (!isAdminOrGlobalMod && meta.config['email:disableEdit']) {
		data.email = oldUserData.email;
	}

	data.uid = targetUid;	// The `uid` argument in `updateProfile` refers to calling user, not target user
	await user.updateProfile(caller.uid, data);
	const userData = await user.getUserData(data.uid);

	async function log(type, eventData) {
		eventData.type = type;
		eventData.uid = caller.uid;
		eventData.targetUid = targetUid;
		eventData.ip = caller.ip;
		await events.log(eventData);
	}

	if (userData.email !== oldUserData.email) {
		await log('email-change', { oldEmail: oldUserData.email, newEmail: userData.email });
	}

	if (userData.username !== oldUserData.username) {
		await log('username-change', { oldUsername: oldUserData.username, newUsername: userData.username });
	}
};
