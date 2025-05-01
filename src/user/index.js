'use strict';

const _ = require('lodash');

const groups = require('../groups');
const plugins = require('../plugins');
const db = require('../database');
const privileges = require('../privileges');
const categories = require('../categories');
const meta = require('../meta');
const activitypub = require('../activitypub');
const utils = require('../utils');

const User = module.exports;

User.email = require('./email');
User.notifications = require('./notifications');
User.reset = require('./reset');
User.digest = require('./digest');
User.interstitials = require('./interstitials');

require('./data')(User);
require('./auth')(User);
require('./bans')(User);
require('./create')(User);
require('./posts')(User);
require('./topics')(User);
require('./categories')(User);
require('./follow')(User);
require('./profile')(User);
require('./admin')(User);
require('./delete')(User);
require('./settings')(User);
require('./search')(User);
require('./jobs')(User);
require('./picture')(User);
require('./approval')(User);
require('./invite')(User);
require('./password')(User);
require('./info')(User);
require('./online')(User);
require('./blocks')(User);
require('./uploads')(User);

User.exists = async function (uids) {
	const singular = !Array.isArray(uids);
	uids = singular ? [uids] : uids;

	const [localExists, remoteExists] = await Promise.all([
		db.isSortedSetMembers('users:joindate', uids),
		meta.config.activitypubEnabled ? db.exists(uids.map(uid => `userRemote:${uid}`)) : uids.map(() => false),
	]);
	const results = localExists.map((local, idx) => local || remoteExists[idx]);
	return singular ? results.pop() : results;
};

User.existsBySlug = async function (userslug) {
	if (Array.isArray(userslug)) {
		const uids = await User.getUidsByUserslugs(userslug);
		return uids.map(uid => !!uid);
	}
	const uid = await User.getUidByUserslug(userslug);
	return !!uid;
};

User.getUidsFromSet = async function (set, start, stop) {
	if (set === 'users:online') {
		const count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;
		const now = Date.now();
		return await db.getSortedSetRevRangeByScore(set, start, count, '+inf', now - (meta.config.onlineCutoff * 60000));
	}
	return await db.getSortedSetRevRange(set, start, stop);
};

User.getUsersFromSet = async function (set, uid, start, stop) {
	const uids = await User.getUidsFromSet(set, start, stop);
	return await User.getUsers(uids, uid);
};

User.getUsersWithFields = async function (uids, fields, uid) {
	let results = await plugins.hooks.fire('filter:users.addFields', { fields: fields });
	results.fields = _.uniq(results.fields);
	const userData = await User.getUsersFields(uids, results.fields);
	results = await plugins.hooks.fire('filter:userlist.get', { users: userData, uid: uid });
	return results.users;
};

User.getUsers = async function (uids, uid) {
	const userData = await User.getUsersWithFields(uids, [
		'uid', 'username', 'userslug', 'picture', 'status',
		'postcount', 'reputation', 'email:confirmed', 'lastonline',
		'flags', 'banned', 'banned:expire', 'joindate',
	], uid);

	return User.hidePrivateData(userData, uid);
};

User.getStatus = function (userData) {
	if (userData.uid <= 0) {
		return 'offline';
	}
	const isOnline = (Date.now() - userData.lastonline) < (meta.config.onlineCutoff * 60000);
	return isOnline ? (userData.status || 'online') : 'offline';
};

User.getUidByUsername = async function (username) {
	if (!username) {
		return 0;
	}
	return await db.sortedSetScore('username:uid', username);
};

User.getUidsByUsernames = async function (usernames) {
	return await db.sortedSetScores('username:uid', usernames);
};

User.getUidByUserslug = async function (userslug) {
	if (!userslug) {
		return 0;
	}

	if (userslug.includes('@')) {
		await activitypub.actors.assert(userslug);
		return (await db.getObjectField('handle:uid', String(userslug).toLowerCase())) || null;
	}

	return await db.sortedSetScore('userslug:uid', userslug);
};

User.getUidsByUserslugs = async function (userslugs) {
	const apSlugs = userslugs.filter(slug => slug.includes('@'));
	const normalSlugs = userslugs.filter(slug => !slug.includes('@'));
	const slugToUid = Object.create(null);
	async function getApSlugs() {
		await Promise.all(apSlugs.map(slug => activitypub.actors.assert(slug)));
		const apUids = await db.getObjectFields(
			'handle:uid',
			apSlugs.map(slug => String(slug).toLowerCase()),
		);
		return apUids;
	}

	const [apUids, normalUids] = await Promise.all([
		apSlugs.length ? getApSlugs() : [],
		normalSlugs.length ? db.sortedSetScores('userslug:uid', normalSlugs) : [],
	]);

	apSlugs.forEach((slug) => {
		if (apUids[slug]) {
			slugToUid[slug] = apUids[slug];
		}
	});

	normalSlugs.forEach((slug, i) => {
		if (normalUids[i]) {
			slugToUid[slug] = normalUids[i];
		}
	});

	return userslugs.map(slug => slugToUid[slug] || null);
};

User.getUsernamesByUids = async function (uids) {
	const users = await User.getUsersFields(uids, ['username']);
	return users.map(user => user.username);
};

User.getUsernameByUserslug = async function (slug) {
	const uid = await User.getUidByUserslug(slug);
	return await User.getUserField(uid, 'username');
};

User.getUidByEmail = async function (email) {
	return await db.sortedSetScore('email:uid', email.toLowerCase());
};

User.getUidsByEmails = async function (emails) {
	emails = emails.map(email => email && email.toLowerCase());
	return await db.sortedSetScores('email:uid', emails);
};

User.getUsernameByEmail = async function (email) {
	const uid = await db.sortedSetScore('email:uid', String(email).toLowerCase());
	return await User.getUserField(uid, 'username');
};

User.isModerator = async function (uid, cid) {
	return await privileges.users.isModerator(uid, cid);
};

User.isModeratorOfAnyCategory = async function (uid) {
	const cids = await User.getModeratedCids(uid);
	return Array.isArray(cids) ? !!cids.length : false;
};

User.isAdministrator = async function (uid) {
	return await privileges.users.isAdministrator(uid);
};

User.isGlobalModerator = async function (uid) {
	return await privileges.users.isGlobalModerator(uid);
};

User.getPrivileges = async function (uid) {
	return await utils.promiseParallel({
		isAdmin: User.isAdministrator(uid),
		isGlobalModerator: User.isGlobalModerator(uid),
		isModeratorOfAnyCategory: User.isModeratorOfAnyCategory(uid),
	});
};

User.isPrivileged = async function (uid) {
	if (!(parseInt(uid, 10) > 0)) {
		return false;
	}
	const results = await User.getPrivileges(uid);
	return results ? (results.isAdmin || results.isGlobalModerator || results.isModeratorOfAnyCategory) : false;
};

User.isAdminOrGlobalMod = async function (uid) {
	const [isAdmin, isGlobalMod] = await Promise.all([
		User.isAdministrator(uid),
		User.isGlobalModerator(uid),
	]);
	return isAdmin || isGlobalMod;
};

User.isAdminOrSelf = async function (callerUid, uid) {
	await isSelfOrMethod(callerUid, uid, User.isAdministrator);
};

User.isAdminOrGlobalModOrSelf = async function (callerUid, uid) {
	await isSelfOrMethod(callerUid, uid, User.isAdminOrGlobalMod);
};

User.isPrivilegedOrSelf = async function (callerUid, uid) {
	await isSelfOrMethod(callerUid, uid, User.isPrivileged);
};

async function isSelfOrMethod(callerUid, uid, method) {
	if (parseInt(callerUid, 10) === parseInt(uid, 10)) {
		return;
	}
	const isPass = await method(callerUid);
	if (!isPass) {
		throw new Error('[[error:no-privileges]]');
	}
}

User.getAdminsandGlobalMods = async function () {
	const results = await groups.getMembersOfGroups(['administrators', 'Global Moderators']);
	return await User.getUsersData(_.union(...results));
};

User.getAdminsandGlobalModsandModerators = async function () {
	const results = await Promise.all([
		groups.getMembers('administrators', 0, -1),
		groups.getMembers('Global Moderators', 0, -1),
		User.getModeratorUids(),
	]);
	return await User.getUsersData(_.union(...results));
};

User.getFirstAdminUid = async function () {
	return (await db.getSortedSetRange('group:administrators:members', 0, 0))[0];
};

User.getModeratorUids = async function () {
	const cids = await categories.getAllCidsFromSet('categories:cid');
	const uids = await categories.getModeratorUids(cids);
	return _.union(...uids);
};

User.getModeratedCids = async function (uid) {
	if (parseInt(uid, 10) <= 0) {
		return [];
	}
	const cids = await categories.getAllCidsFromSet('categories:cid');
	const isMods = await User.isModerator(uid, cids);
	return cids.filter((cid, index) => cid && isMods[index]);
};

User.addInterstitials = function (callback) {
	plugins.hooks.register('core', {
		hook: 'filter:register.interstitial',
		method: [
			User.interstitials.email, // Email address
			User.interstitials.gdpr, // GDPR information collection/processing consent + email consent
			User.interstitials.tou, // Forum Terms of Use
		],
	});

	callback();
};

require('../promisify')(User);
