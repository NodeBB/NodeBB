'use strict';

const path = require('path');
const fs = require('fs').promises;

const validator = require('validator');
const winston = require('winston');

const db = require('../database');
const user = require('../user');
const groups = require('../groups');
const meta = require('../meta');
const messaging = require('../messaging');
const flags = require('../flags');
const privileges = require('../privileges');
const notifications = require('../notifications');
const plugins = require('../plugins');
const events = require('../events');
const translator = require('../translator');
const sockets = require('../socket.io');
const utils = require('../utils');

const usersAPI = module.exports;

const hasAdminPrivilege = async (uid, privilege) => {
	const ok = await privileges.admin.can(`admin:${privilege}`, uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}
};

usersAPI.create = async function (caller, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	await hasAdminPrivilege(caller.uid, 'users');

	const uid = await user.create(data);
	return await user.getUserData(uid);
};

usersAPI.get = async (caller, { uid }) => {
	const canView = await privileges.global.can('view:users', caller.uid);
	if (!canView) {
		throw new Error('[[error:no-privileges]]');
	}
	const userData = await user.getUserData(uid);
	return await user.hidePrivateData(userData, caller.uid);
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
	if (data.hasOwnProperty('email') || data.hasOwnProperty('username')) {
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

	if (userData.username !== oldUserData.username) {
		await events.log({
			type: 'username-change',
			uid: caller.uid,
			targetUid: data.uid,
			ip: caller.ip,
			oldUsername: oldUserData.username,
			newUsername: userData.username,
		});
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
	await hasAdminPrivilege(caller.uid, 'users');

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

	let defaults = await user.getSettings(0);
	defaults = {
		postsPerPage: defaults.postsPerPage,
		topicsPerPage: defaults.topicsPerPage,
		userLang: defaults.userLang,
		acpLang: defaults.acpLang,
	};
	// load raw settings without parsing values to booleans
	const current = await db.getObject(`user:${data.uid}:settings`);
	const payload = { ...defaults, ...current, ...data.settings };
	delete payload.uid;

	return await user.saveSettings(data.uid, payload);
};

usersAPI.getStatus = async (caller, { uid }) => {
	const status = await db.getObjectField(`user:${uid}`, 'status');
	return { status };
};

usersAPI.getPrivateRoomId = async (caller, { uid } = {}) => {
	if (!uid) {
		throw new Error('[[error:invalid-data]]');
	}

	let roomId = await messaging.hasPrivateChat(caller.uid, uid);
	roomId = parseInt(roomId, 10);

	return {
		roomId: roomId > 0 ? roomId : null,
	};
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
	const { displayname } = userData;

	const notifObj = await notifications.create({
		type: 'follow',
		bodyShort: `[[notifications:user-started-following-you, ${displayname}]]`,
		nid: `follow:${data.uid}:uid:${caller.uid}`,
		from: caller.uid,
		path: `/uid/${data.uid}/followers`,
		mergeId: 'notifications:user-started-following-you',
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
	await db.setObjectField(`uid:${data.uid}:ban:${banData.timestamp}`, 'fromUid', caller.uid);

	if (!data.reason) {
		data.reason = await translator.translate('[[user:info.banned-no-reason]]');
	}

	sockets.in(`uid_${data.uid}`).emit('event:banned', {
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
	const canLoginIfBanned = await user.bans.canLoginIfBanned(data.uid);
	if (!canLoginIfBanned) {
		await user.auth.revokeAllSessions(data.uid);
	}
};

usersAPI.unban = async function (caller, data) {
	if (!await privileges.users.hasBanPrivilege(caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	const unbanData = await user.bans.unban(data.uid, data.reason);
	await db.setObjectField(`uid:${data.uid}:unban:${unbanData.timestamp}`, 'fromUid', caller.uid);

	sockets.in(`uid_${data.uid}`).emit('event:unbanned');

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

usersAPI.mute = async function (caller, data) {
	if (!await privileges.users.hasMutePrivilege(caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	} else if (await user.isAdministrator(data.uid)) {
		throw new Error('[[error:cant-mute-other-admins]]');
	}
	const reason = data.reason || '[[user:info.muted-no-reason]]';
	await db.setObject(`user:${data.uid}`, {
		mutedUntil: data.until,
		mutedReason: reason,
	});
	const now = Date.now();
	const muteKey = `uid:${data.uid}:mute:${now}`;
	const muteData = {
		type: 'mute',
		fromUid: caller.uid,
		uid: data.uid,
		timestamp: now,
		expire: data.until,
	};
	if (data.reason) {
		muteData.reason = reason;
	}
	await db.sortedSetAdd(`uid:${data.uid}:mutes:timestamp`, now, muteKey);
	await db.setObject(muteKey, muteData);
	await events.log({
		type: 'user-mute',
		uid: caller.uid,
		targetUid: data.uid,
		ip: caller.ip,
		reason: data.reason || undefined,
	});
	plugins.hooks.fire('action:user.muted', {
		callerUid: caller.uid,
		ip: caller.ip,
		uid: data.uid,
		until: data.until > 0 ? data.until : undefined,
		reason: data.reason || undefined,
	});
};

usersAPI.unmute = async function (caller, data) {
	if (!await privileges.users.hasMutePrivilege(caller.uid)) {
		throw new Error('[[error:no-privileges]]');
	}

	await db.deleteObjectFields(`user:${data.uid}`, ['mutedUntil', 'mutedReason']);
	const now = Date.now();
	const unmuteKey = `uid:${data.uid}:unmute:${now}`;
	const unmuteData = {
		type: 'unmute',
		fromUid: caller.uid,
		uid: data.uid,
		timestamp: now,
	};
	if (data.reason) {
		unmuteData.reason = data.reason;
	}
	await db.sortedSetAdd(`uid:${data.uid}:unmutes:timestamp`, now, unmuteKey);
	await db.setObject(unmuteKey, unmuteData);
	await events.log({
		type: 'user-unmute',
		uid: caller.uid,
		targetUid: data.uid,
		ip: caller.ip,
	});
	plugins.hooks.fire('action:user.unmuted', {
		callerUid: caller.uid,
		ip: caller.ip,
		uid: data.uid,
	});
};

usersAPI.generateToken = async (caller, { uid, description }) => {
	const api = require('.');
	await hasAdminPrivilege(caller.uid, 'settings');
	if (parseInt(uid, 10) !== parseInt(caller.uid, 10)) {
		throw new Error('[[error:invalid-uid]]');
	}

	const tokenObj = await api.utils.tokens.generate({ uid, description });
	return tokenObj.token;
};

usersAPI.deleteToken = async (caller, { uid, token }) => {
	const api = require('.');
	await hasAdminPrivilege(caller.uid, 'settings');
	if (parseInt(uid, 10) !== parseInt(caller.uid, 10)) {
		throw new Error('[[error:invalid-uid]]');
	}

	await api.utils.tokens.delete(token);
	return true;
};

usersAPI.revokeSession = async (caller, { uid, uuid }) => {
	// Only admins or global mods (besides the user themselves) can revoke sessions
	if (parseInt(uid, 10) !== caller.uid && !await user.isAdminOrGlobalMod(caller.uid)) {
		throw new Error('[[error:invalid-uid]]');
	}

	const sids = await db.getSortedSetRange(`uid:${uid}:sessions`, 0, -1);
	let _id;
	for (const sid of sids) {
		/* eslint-disable no-await-in-loop */
		const sessionObj = await db.sessionStoreGet(sid);
		if (sessionObj && sessionObj.meta && sessionObj.meta.uuid === uuid) {
			_id = sid;
			break;
		}
	}

	if (!_id) {
		throw new Error('[[error:no-session-found]]');
	}

	await user.auth.revokeSession(_id, uid);
};

usersAPI.invite = async (caller, { emails, groupsToJoin, uid }) => {
	if (!emails || !Array.isArray(groupsToJoin)) {
		throw new Error('[[error:invalid-data]]');
	}

	// For simplicity, this API route is restricted to self-use only. This can change if needed.
	if (parseInt(caller.uid, 10) !== parseInt(uid, 10)) {
		throw new Error('[[error:no-privileges]]');
	}

	const canInvite = await privileges.users.hasInvitePrivilege(caller.uid);
	if (!canInvite) {
		throw new Error('[[error:no-privileges]]');
	}

	const { registrationType } = meta.config;
	const isAdmin = await user.isAdministrator(caller.uid);
	if (registrationType === 'admin-invite-only' && !isAdmin) {
		throw new Error('[[error:no-privileges]]');
	}

	const inviteGroups = (await groups.getUserInviteGroups(caller.uid)).map(group => group.name);
	const cannotInvite = groupsToJoin.some(group => !inviteGroups.includes(group));
	if (groupsToJoin.length > 0 && cannotInvite) {
		throw new Error('[[error:no-privileges]]');
	}

	const max = meta.config.maximumInvites;
	const emailsArr = emails.split(',').map(email => email.trim()).filter(Boolean);

	for (const email of emailsArr) {
		/* eslint-disable no-await-in-loop */
		let invites = 0;
		if (max) {
			invites = await user.getInvitesNumber(caller.uid);
		}
		if (!isAdmin && max && invites >= max) {
			throw new Error(`[[error:invite-maximum-met, ${invites}, ${max}]]`);
		}

		await user.sendInvitationEmail(caller.uid, email, groupsToJoin);
	}
};

usersAPI.getInviteGroups = async (caller, { uid }) => {
	// For simplicity, this API route is restricted to self-use only. This can change if needed.
	if (parseInt(uid, 10) !== parseInt(caller.uid, 10)) {
		throw new Error('[[error:no-privileges]]');
	}

	const userInviteGroups = await groups.getUserInviteGroups(uid);
	return userInviteGroups.map(group => group.displayName);
};

usersAPI.addEmail = async (caller, { email, skipConfirmation, uid }) => {
	const isSelf = parseInt(caller.uid, 10) === parseInt(uid, 10);
	const canEdit = await privileges.users.canEdit(caller.uid, uid);
	if (skipConfirmation && canEdit && !isSelf) {
		if (!email.length) {
			await user.email.remove(uid);
		} else {
			if (!await user.email.available(email)) {
				throw new Error('[[error:email-taken]]');
			}
			await user.setUserField(uid, 'email', email);
			await user.email.confirmByUid(uid, caller.uid);
		}
	} else {
		await usersAPI.update(caller, { uid, email });
	}

	return await db.getSortedSetRangeByScore('email:uid', 0, 500, uid, uid);
};

usersAPI.listEmails = async (caller, { uid }) => {
	const [isPrivileged, { showemail }] = await Promise.all([
		user.isPrivileged(caller.uid),
		user.getSettings(uid),
	]);
	const isSelf = caller.uid === parseInt(uid, 10);

	if (isSelf || isPrivileged || showemail) {
		return await db.getSortedSetRangeByScore('email:uid', 0, 500, uid, uid);
	}

	return null;
};

usersAPI.getEmail = async (caller, { uid, email }) => {
	const [isPrivileged, { showemail }, exists] = await Promise.all([
		user.isPrivileged(caller.uid),
		user.getSettings(uid),
		db.isSortedSetMember('email:uid', email.toLowerCase()),
	]);
	const isSelf = caller.uid === parseInt(uid, 10);

	return exists && (isSelf || isPrivileged || showemail);
};

usersAPI.confirmEmail = async (caller, { uid, email, sessionId }) => {
	const [pending, current, canManage] = await Promise.all([
		user.email.isValidationPending(uid, email),
		user.getUserField(uid, 'email'),
		privileges.admin.can('admin:users', caller.uid),
	]);

	if (!canManage) {
		throw new Error('[[error:no-privileges]]');
	}

	if (pending) { // has active confirmation request
		const code = await db.get(`confirm:byUid:${uid}`);
		await user.email.confirmByCode(code, sessionId);
		return true;
	} else if (current && current === email) { // i.e. old account w/ unconf. email in user hash
		await user.email.confirmByUid(uid, caller.uid);
		return true;
	}

	return false;
};

async function isPrivilegedOrSelfAndPasswordMatch(caller, data) {
	const { uid } = caller;
	const isSelf = parseInt(uid, 10) === parseInt(data.uid, 10);
	const canEdit = await privileges.users.canEdit(uid, data.uid);

	if (!canEdit) {
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
	const isSelf = parseInt(uid, 10) === parseInt(caller.uid, 10);
	const hasAdminPrivilege = await privileges.admin.can('admin:users', caller.uid);

	if (isSelf && meta.config.allowAccountDelete !== 1) {
		throw new Error('[[error:account-deletion-disabled]]');
	} else if (!isSelf && !hasAdminPrivilege) {
		throw new Error('[[error:no-privileges]]');
	} else if (isTargetAdmin) {
		throw new Error('[[error:cant-delete-admin]');
	}

	// Privilege checks -- only deleteAccount is available for non-admins
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
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
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
		uid: caller.uid,
		query: data.query,
		searchBy: data.searchBy || 'username',
		page: data.page || 1,
		sortBy: data.sortBy || 'lastonline',
		filters: filters,
	});
};

usersAPI.changePicture = async (caller, data) => {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}

	const { type, url } = data;
	let picture = '';

	await user.checkMinReputation(caller.uid, data.uid, 'min:rep:profile-picture');
	const canEdit = await privileges.users.canEdit(caller.uid, data.uid);
	if (!canEdit) {
		throw new Error('[[error:no-privileges]]');
	}

	if (type === 'default') {
		picture = '';
	} else if (type === 'uploaded') {
		picture = await user.getUserField(data.uid, 'uploadedpicture');
	} else if (type === 'external' && url) {
		picture = validator.escape(url);
	} else {
		const returnData = await plugins.hooks.fire('filter:user.getPicture', {
			uid: caller.uid,
			type: type,
			picture: undefined,
		});
		picture = returnData && returnData.picture;
	}

	const validBackgrounds = await user.getIconBackgrounds();
	if (!validBackgrounds.includes(data.bgColor)) {
		data.bgColor = validBackgrounds[0];
	}

	await user.updateProfile(caller.uid, {
		uid: data.uid,
		picture: picture,
		'icon:bgColor': data.bgColor,
	}, ['picture', 'icon:bgColor']);
};

const exportMetadata = new Map([
	['posts', ['csv', 'text/csv']],
	['uploads', ['zip', 'application/zip']],
	['profile', ['json', 'application/json']],
]);

const prepareExport = async ({ uid, type }) => {
	const [extension] = exportMetadata.get(type);
	const filename = `${uid}_${type}.${extension}`;
	try {
		const stat = await fs.stat(path.join(__dirname, '../../build/export', filename));
		return stat;
	} catch (e) {
		return false;
	}
};

usersAPI.checkExportByType = async (caller, { uid, type }) => await prepareExport({ uid, type });

usersAPI.getExportByType = async (caller, { uid, type }) => {
	const [extension, mime] = exportMetadata.get(type);
	const filename = `${uid}_${type}.${extension}`;

	const exists = await prepareExport({ uid, type });
	if (exists) {
		return { filename, mime };
	}

	return false;
};

usersAPI.generateExport = async (caller, { uid, type }) => {
	const validTypes = ['profile', 'posts', 'uploads'];
	if (!validTypes.includes(type)) {
		throw new Error('[[error:invalid-data]]');
	}
	if (!utils.isNumber(uid) || !(parseInt(uid, 10) > 0)) {
		throw new Error('[[error:invalid-uid]]');
	}
	const count = await db.incrObjectField('locks', `export:${uid}${type}`);
	if (count > 1) {
		throw new Error('[[error:already-exporting]]');
	}

	const child = require('child_process').fork(`./src/user/jobs/export-${type}.js`, [], {
		env: process.env,
	});
	child.send({ uid });
	child.on('error', async (err) => {
		winston.error(err.stack);
		await db.deleteObjectField('locks', `export:${uid}${type}`);
	});
	child.on('exit', async () => {
		await db.deleteObjectField('locks', `export:${uid}${type}`);
		const { displayname } = await user.getUserFields(uid, ['username']);
		const n = await notifications.create({
			bodyShort: `[[notifications:${type}-exported, ${displayname}]]`,
			path: `/api/v3/users/${uid}/exports/${type}`,
			nid: `${type}:export:${uid}`,
			from: uid,
		});
		await notifications.push(n, [caller.uid]);
		await events.log({
			type: `export:${type}`,
			uid: caller.uid,
			targetUid: uid,
			ip: caller.ip,
		});
	});
};
