'use strict';

const db = require('../database');
const user = require('../user');
const groups = require('../groups');
const meta = require('../meta');
const flags = require('../flags');
const privileges = require('../privileges');
const notifications = require('../notifications');
const plugins = require('../plugins');
const events = require('../events');
const translator = require('../translator');
const sockets = require('../socket.io');

const usersAPI = module.exports;

usersAPI.create = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const uid = await user.create(data);
	return await user.getUserData(uid);
};

usersAPI.update = async function (caller, data) {
	if (!caller.uid) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (!data || !data.uid) {
		throw new Error('[[error:invalid-data]]');
	}

	const oldUserData = await user.getUserFields(data.uid, ['email', 'username']);
	if (!oldUserData || !oldUserData.username) {
		throw new Error('[[error:invalid-data]]');
	}

	const [isAdminOrGlobalMod, canEdit, hasPassword, passwordMatch] = await Promise.all([
		user.isAdminOrGlobalMod(caller.uid),
		privileges.users.canEdit(caller.uid, data.uid),
		user.hasPassword(data.uid),
		data.password ? user.isPasswordCorrect(data.uid, data.password, caller.ip) : false,
	]);

	// Changing own email/username requires password confirmation
	if (['email', 'username'].some(prop => Object.keys(data).includes(prop)) && !isAdminOrGlobalMod && caller.uid === data.uid && hasPassword && !passwordMatch) {
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

	await user.updateProfile(caller.uid, data);
	const userData = await user.getUserData(data.uid);

	async function log(type, eventData) {
		eventData.type = type;
		eventData.uid = caller.uid;
		eventData.targetUid = data.uid;
		eventData.ip = caller.ip;
		await events.log(eventData);
	}

	if (userData.email !== oldUserData.email) {
		await log('email-change', { oldEmail: oldUserData.email, newEmail: userData.email });
	}

	if (userData.username !== oldUserData.username) {
		await log('username-change', { oldUsername: oldUserData.username, newUsername: userData.username });
	}

	return userData;
};

usersAPI.delete = async function (caller, data) {
	processDeletion(data.uid, caller);
};

usersAPI.deleteMany = async function (caller, data) {
	if (await canDeleteUids(data.uids)) {
		await Promise.all(data.uids.map(uid => processDeletion(uid, caller)));
	}
};

usersAPI.changePassword = async function (caller, data) {
	await user.changePassword(caller.uid, Object.assign(data, { ip: caller.ip }));
	await events.log({
		type: 'password-change',
		uid: caller.uid,
		targetUid: data.uid,
		ip: caller.ip,
	});
};

usersAPI.follow = async function (caller, data) {
	await user.follow(caller.uid, data.uid);
	plugins.fireHook('action:user.follow', {
		fromUid: caller.uid,
		toUid: data.uid,
	});

	const userData = await user.getUserFields(caller.uid, ['username', 'userslug']);
	const notifObj = await notifications.create({
		type: 'follow',
		bodyShort: '[[notifications:user_started_following_you, ' + userData.username + ']]',
		nid: 'follow:' + data.uid + ':uid:' + caller.uid,
		from: caller.uid,
		path: '/uid/' + data.uid + '/followers',
		mergeId: 'notifications:user_started_following_you',
	});
	if (!notifObj) {
		return;
	}
	notifObj.user = userData;
	await notifications.push(notifObj, [data.uid]);
};

usersAPI.unfollow = async function (caller, data) {
	await user.unfollow(caller.uid, data.uid);
	plugins.fireHook('action:user.unfollow', {
		fromUid: caller.uid,
		toUid: data.uid,
	});
};

usersAPI.ban = async function (caller, data) {
	if (!await privileges.users.hasBanPrivilege(caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	} else if (await user.isAdministrator(data.uid)) {
		throw new Error('[[error:cant-ban-other-admins]]');
	}

	const banData = await user.bans.ban(data.uid, data.until, data.reason);
	await db.setObjectField('uid:' + data.uid + ':ban:' + banData.timestamp, 'fromUid', caller.uid);

	if (!data.reason) {
		data.reason = await translator.translate('[[user:info.banned-no-reason]]');
	}

	sockets.in('uid_' + data.uid).emit('event:banned', {
		until: data.until,
		reason: data.reason,
	});

	await flags.resolveFlag('user', data.uid, caller.uid);
	await flags.resolveUserPostFlags(data.uid, caller.uid);
	await events.log({
		type: 'user-ban',
		uid: caller.uid,
		targetUid: data.uid,
		ip: caller.ip,
		reason: data.reason || undefined,
	});
	plugins.fireHook('action:user.banned', {
		callerUid: caller.uid,
		ip: caller.ip,
		uid: data.uid,
		until: data.until > 0 ? data.until : undefined,
		reason: data.reason || undefined,
	});
	await user.auth.revokeAllSessions(data.uid);
};

usersAPI.unban = async function (caller, data) {
	if (!await privileges.users.hasBanPrivilege(caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	await user.bans.unban(data.uid);
	await events.log({
		type: 'user-unban',
		uid: caller.uid,
		targetUid: data.uid,
		ip: caller.ip,
	});
	plugins.fireHook('action:user.unbanned', {
		callerUid: caller.uid,
		ip: caller.ip,
		uid: data.uid,
	});
};

async function processDeletion(uid, caller) {
	const isTargetAdmin = await user.isAdministrator(uid);
	const isSelf = parseInt(uid, 10) === caller.uid;
	const isAdmin = await user.isAdministrator(caller.uid);

	if (!isSelf && !isAdmin) {
		throw new Error('[[error:no-privileges]]');
	} else if (!isSelf && isTargetAdmin) {
		throw new Error('[[error:cant-delete-other-admins]]');
	}

	// TODO: clear user tokens for this uid
	await flags.resolveFlag('user', uid, caller.uid);
	const userData = await user.delete(caller.uid, uid);
	await events.log({
		type: 'user-delete',
		uid: caller.uid,
		targetUid: uid,
		ip: caller.ip,
		username: userData.username,
		email: userData.email,
	});
}

async function canDeleteUids(uids) {
	if (!Array.isArray(uids)) {
		throw new Error('[[error:invalid-data]]');
	}
	const isMembers = await groups.isMembers(uids, 'administrators');
	if (isMembers.includes(true)) {
		throw new Error('[[error:cant-delete-other-admins]]');
	}

	return true;
}
