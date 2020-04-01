'use strict';

const user = require('../../user');
const groups = require('../../groups');
const plugins = require('../../plugins');
const privileges = require('../../privileges');
const notifications = require('../../notifications');
const meta = require('../../meta');
const events = require('../../events');
const helpers = require('../helpers');

const Users = module.exports;

Users.create = async (req, res) => {
	const uid = await user.create(req.body);
	helpers.formatApiResponse(200, res, await user.getUserData(uid));
};

Users.update = async (req, res) => {
	const oldUserData = await user.getUserFields(req.params.uid, ['email', 'username']);
	if (!oldUserData || !oldUserData.username) {
		throw new Error('[[error:invalid-data]]');
	}

	const [isAdminOrGlobalMod, canEdit, passwordMatch] = await Promise.all([
		user.isAdminOrGlobalMod(req.user.uid),
		privileges.users.canEdit(req.user.uid, req.params.uid),
		user.isPasswordCorrect(req.body.uid, req.body.password, req.ip),
	]);

	// Changing own email/username requires password confirmation
	if (req.user.uid === req.body.uid && !passwordMatch) {
		helpers.formatApiResponse(403, res, new Error('[[error:invalid-password]]'));
	}

	if (!canEdit) {
		helpers.formatApiResponse(403, res, new Error('[[error:no-privileges]]'));
	}

	if (!isAdminOrGlobalMod && meta.config['username:disableEdit']) {
		req.body.username = oldUserData.username;
	}

	if (!isAdminOrGlobalMod && meta.config['email:disableEdit']) {
		req.body.email = oldUserData.email;
	}

	req.body.uid = req.params.uid;	// The `uid` argument in `updateProfile` refers to calling user, not target user
	await user.updateProfile(req.user.uid, req.body);
	const userData = await user.getUserData(req.body.uid);

	async function log(type, eventData) {
		eventData.type = type;
		eventData.uid = req.user.uid;
		eventData.targetUid = req.params.uid;
		eventData.ip = req.ip;
		await events.log(eventData);
	}

	if (userData.email !== oldUserData.email) {
		await log('email-change', { oldEmail: oldUserData.email, newEmail: userData.email });
	}

	if (userData.username !== oldUserData.username) {
		await log('username-change', { oldUsername: oldUserData.username, newUsername: userData.username });
	}

	helpers.formatApiResponse(200, res, userData);
};

Users.delete = async (req, res) => {
	processDeletion(req.params.uid, req, res);
	helpers.formatApiResponse(200, res);
};

Users.deleteMany = async (req, res) => {
	await canDeleteUids(req.body.uids, res);
	await Promise.all(req.body.uids.map(uid => processDeletion(uid, req, res)));
	helpers.formatApiResponse(200, res);
};

async function canDeleteUids(uids, res) {
	if (!Array.isArray(uids)) {
		helpers.formatApiResponse(400, res, new Error('[[error:invalid-data]]'));
	}
	const isMembers = await groups.isMembers(uids, 'administrators');
	if (isMembers.includes(true)) {
		helpers.formatApiResponse(403, res, new Error('[[error:cant-delete-other-admins]]'));
	}
}

async function processDeletion(uid, req, res) {
	const isTargetAdmin = await user.isAdministrator(uid);
	if (!res.locals.privileges.isSelf && !res.locals.privileges.isAdmin) {
		return helpers.formatApiResponse(403, res);
	} else if (!res.locals.privileges.isSelf && isTargetAdmin) {
		return helpers.formatApiResponse(403, res, new Error('[[error:cant-delete-other-admins]]'));
	}

	// TODO: clear user tokens for this uid
	const userData = await user.delete(req.user.uid, uid);
	await events.log({
		type: 'user-delete',
		uid: req.user.uid,
		targetUid: uid,
		ip: req.ip,
		username: userData.username,
		email: userData.email,
	});
}

Users.changePassword = async (req, res) => {
	req.body.uid = req.params.uid;
	await user.changePassword(req.user.uid, Object.assign(req.body, { ip: req.ip }));
	await events.log({
		type: 'password-change',
		uid: req.user.uid,
		targetUid: req.params.uid,
		ip: req.ip,
	});

	helpers.formatApiResponse(200, res);
};

Users.follow = async (req, res) => {
	await user.follow(req.user.uid, req.params.uid);
	plugins.fireHook('action:user.follow', {
		fromUid: req.user.uid,
		toUid: req.params.uid,
	});

	const userData = await user.getUserFields(req.user.uid, ['username', 'userslug']);
	const notifObj = await notifications.create({
		type: 'follow',
		bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
		nid: 'follow:' + req.params.uid + ':uid:' + req.user.uid,
		from: req.user.uid,
		path: '/uid/' + req.params.uid + '/followers',
		mergeId: 'notifications:user_started_following_you',
	});
	if (!notifObj) {
		return;
	}
	notifObj.user = userData;
	await notifications.push(notifObj, [req.params.uid]);

	helpers.formatApiResponse(200, res);
};

Users.unfollow = async (req, res) => {
	await user.unfollow(req.user.uid, req.params.uid);
	plugins.fireHook('action:user.unfollow', {
		fromUid: req.user.uid,
		toUid: req.params.uid,
	});
	helpers.formatApiResponse(200, res);
};
