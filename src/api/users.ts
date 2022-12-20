'use strict';

import validator from 'validator';
import winston from 'winston';
import db from '../database';
import user from '../user';
import groups from '../groups';
import meta from '../meta';
import child from 'child_process';
import flags from '../flags';
import privileges from '../privileges';
import notifications from '../notifications';
import plugins from '../plugins';
import events from '../events';
import translator from '../translator';
import sockets from '../socket.io';

const usersAPI = {} as any;

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
	if (await canDeleteUids(data.uids)) {
		await Promise.all(data.uids.map(uid => processDeletion({ uid, method: 'delete', caller } as any)));
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
		bodyShort: `[[notifications:user_started_following_you, ${displayname}]]`,
		nid: `follow:${data.uid}:uid:${caller.uid}`,
		from: caller.uid,
		path: `/uid/${data.uid}/followers`,
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

	await user.bans.unban(data.uid);

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
		fromUid: caller.uid,
		uid: data.uid,
		timestamp: now,
		expire: data.until,
	} as any;
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
	const isAdmin = await user.isAdministrator(caller.uid);

	if (isSelf && meta.config.allowAccountDelete !== 1) {
		throw new Error('[[error:account-deletion-disabled]]');
	} else if (!isSelf && !isAdmin) {
		throw new Error('[[error:no-privileges]]');
	} else if (isTargetAdmin) {
		throw new Error('[[error:cant-delete-admin]');
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

	const validBackgrounds = await user.getIconBackgrounds(caller.uid);
	if (!validBackgrounds.includes(data.bgColor)) {
		data.bgColor = validBackgrounds[0];
	}

	await user.updateProfile(caller.uid, {
		uid: data.uid,
		picture: picture,
		'icon:bgColor': data.bgColor,
	}, ['picture', 'icon:bgColor']);
};

usersAPI.generateExport = async (caller, { uid, type }) => {
	const count = await db.incrObjectField('locks', `export:${uid}${type}`);
	if (count > 1) {
		throw new Error('[[error:already-exporting]]');
	}
	(child as any).fork(`./src/user/jobs/export-${type}.js`, [], {
		env: (process as any).env,
	});
	(child as any).send({ uid });
	(child as any).on('error', async (err) => {
		winston.error(err.stack);
		await db.deleteObjectField('locks', `export:${uid}${type}`);
	});
	(child as any).on('exit', async () => {
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

export default usersAPI;