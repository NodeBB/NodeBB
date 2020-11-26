'use strict';

const validator = require('validator');

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

	const [isAdminOrGlobalMod, canEdit] = await Promise.all([
		user.isAdminOrGlobalMod(caller.uid),
		privileges.users.canEdit(caller.uid, data.uid),
	]);

	// Changing own email/username requires password confirmation
	if (['email', 'username'].some(prop => Object.keys(data).includes(prop))) {
		await isPrivilegedOrSelfAndPasswordMatch(caller, data);
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

usersAPI.delete = async function (caller, { uid, password }) {
	await processDeletion({ uid: uid, method: 'delete', password, caller });
};

usersAPI.deleteContent = async function (caller, { uid, password }) {
	await processDeletion({ uid, method: 'deleteContent', password, caller });
};

usersAPI.deleteAccount = async function (caller, { uid, password }) {
	await processDeletion({ uid, method: 'deleteAccount', password, caller });
};

usersAPI.deleteMany = async function (caller, data) {
	if (await canDeleteUids(data.uids)) {
		await Promise.all(data.uids.map(uid => processDeletion({ uid, method: 'delete', caller })));
	}
};

usersAPI.updateSettings = async function (caller, data) {
	if (!caller.uid || !data || !data.settings) {
		throw new Error('[[error:invalid-data]]');
	}

	const canEdit = await privileges.users.canEdit(caller.uid, data.uid);
	if (!canEdit) {
		throw new Error('[[error:no-privileges]]');
	}

	const current = await user.getSettings(data.uid);
	const payload = { ...current, ...data.settings };
	delete payload.uid;

	return await user.saveSettings(data.uid, payload);
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
	plugins.hooks.fire('action:user.follow', {
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
	plugins.hooks.fire('action:user.unfollow', {
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
		reason: validator.escape(String(data.reason || '')),
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
	plugins.hooks.fire('action:user.banned', {
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
	plugins.hooks.fire('action:user.unbanned', {
		callerUid: caller.uid,
		ip: caller.ip,
		uid: data.uid,
	});
};

async function isPrivilegedOrSelfAndPasswordMatch(caller, data) {
	const uid = caller.uid;
	const isSelf = parseInt(uid, 10) === parseInt(data.uid, 10);

	const [isAdmin, isTargetAdmin, isGlobalMod] = await Promise.all([
		user.isAdministrator(uid),
		user.isAdministrator(data.uid),
		user.isGlobalModerator(uid),
	]);

	if ((isTargetAdmin && !isAdmin) || (!isSelf && !(isAdmin || isGlobalMod))) {
		throw new Error('[[error:no-privileges]]');
	}
	const [hasPassword, passwordMatch] = await Promise.all([
		user.hasPassword(data.uid),
		data.password ? user.isPasswordCorrect(data.uid, data.password, caller.ip) : false,
	]);

	if (isSelf && hasPassword && !passwordMatch) {
		throw new Error('[[error:invalid-password]]');
	}
}

async function processDeletion({ uid, method, password, caller }) {
	const isTargetAdmin = await user.isAdministrator(uid);
	const isSelf = parseInt(uid, 10) === caller.uid;
	const isAdmin = await user.isAdministrator(caller.uid);

	if (meta.config.allowAccountDelete !== 1) {
		throw new Error('[[error:no-privileges]]');
	} else if (!isSelf && !isAdmin) {
		throw new Error('[[error:no-privileges]]');
	} else if (isTargetAdmin) {
		throw new Error('[[error:cant-delete-other-admins]]');
	}

	// Privilege checks -- only deleteAccount is available for non-admins
	const hasAdminPrivilege = await privileges.admin.can('admin:users', caller.uid);
	if (!hasAdminPrivilege && ['delete', 'deleteContent'].includes(method)) {
		throw new Error('[[error:no-privileges]]');
	}

	// Self-deletions require a password
	const hasPassword = await user.hasPassword(uid);
	if (isSelf && hasPassword) {
		const ok = await user.isPasswordCorrect(uid, password, caller.ip);
		if (!ok) {
			throw new Error('[[error:invalid-password]]');
		}
	}

	await flags.resolveFlag('user', uid, caller.uid);

	let userData;
	if (method === 'deleteAccount') {
		userData = await user[method](uid);
	} else {
		userData = await user[method](caller.uid, uid);
	}
	userData = userData || {};

	sockets.server.sockets.emit('event:user_status_change', { uid: caller.uid, status: 'offline' });

	plugins.hooks.fire('action:user.delete', {
		callerUid: caller.uid,
		uid: uid,
		ip: caller.ip,
		user: userData,
	});

	await events.log({
		type: `user-${method}`,
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

usersAPI.search = async function (caller, data) {
	const [allowed, isPrivileged] = await Promise.all([
		privileges.global.can('search:users', caller.uid),
		user.isPrivileged(caller.uid),
	]);
	let filters = data.filters || [];
	filters = Array.isArray(filters) ? filters : [filters];
	if (!allowed ||
		((
			data.searchBy === 'ip' ||
			data.searchBy === 'email' ||
			filters.includes('banned') ||
			filters.includes('flagged')
		) && !isPrivileged)
	) {
		throw new Error('[[error:no-privileges]]');
	}
	return await user.search({
		query: data.query,
		searchBy: data.searchBy || 'username',
		page: data.page || 1,
		sortBy: data.sortBy || 'lastonline',
		filters: filters,
	});
};
