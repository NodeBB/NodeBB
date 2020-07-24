'use strict';

const _ = require('lodash');

const groups = require('../groups');
const plugins = require('../plugins');
const db = require('../database');
const privileges = require('../privileges');
const categories = require('../categories');
const meta = require('../meta');
const utils = require('../utils');

const User = module.exports;

User.email = require('./email');
User.notifications = require('./notifications');
User.reset = require('./reset');
User.digest = require('./digest');

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

User.exists = async function (uid) {
	return await db.isSortedSetMember('users:joindate', uid);
};

User.existsBySlug = async function (userslug) {
	const exists = await User.getUidByUserslug(userslug);
	return !!exists;
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
	let results = await plugins.fireHook('filter:users.addFields', { fields: fields });
	results.fields = _.uniq(results.fields);
	const [userData, isAdmin] = await Promise.all([
		User.getUsersFields(uids, results.fields),
		User.isAdministrator(uids),
	]);
	userData.forEach(function (user, index) {
		if (user) {
			user.administrator = isAdmin[index];
		}
	});
	results = await plugins.fireHook('filter:userlist.get', { users: userData, uid: uid });
	return results.users;
};

User.getUsers = async function (uids, uid) {
	return await User.getUsersWithFields(uids, [
		'uid', 'username', 'userslug', 'picture', 'status',
		'postcount', 'reputation', 'email:confirmed', 'lastonline',
		'flags', 'banned', 'banned:expire', 'joindate',
	], uid);
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
	return await db.sortedSetScore('userslug:uid', userslug);
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
	return await User.getUsersData(_.union.apply(_, results));
};

User.getAdminsandGlobalModsandModerators = async function () {
	const results = await Promise.all([
		groups.getMembers('administrators', 0, -1),
		groups.getMembers('Global Moderators', 0, -1),
		User.getModeratorUids(),
	]);
	return await User.getUsersData(_.union.apply(_, results));
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
	plugins.registerHook('core', {
		hook: 'filter:register.interstitial',
		method: [
			// GDPR information collection/processing consent + email consent
			async function (data) {
				if (!meta.config.gdpr_enabled || (data.userData && data.userData.gdpr_consent)) {
					return data;
				}
				if (!data.userData) {
					throw new Error('[[error:invalid-data]]');
				}

				if (data.userData.uid) {
					const consented = await db.getObjectField('user:' + data.userData.uid, 'gdpr_consent');
					if (parseInt(consented, 10)) {
						return data;
					}
				}

				data.interstitials.push({
					template: 'partials/gdpr_consent',
					data: {
						digestFrequency: meta.config.dailyDigestFreq,
						digestEnabled: meta.config.dailyDigestFreq !== 'off',
					},
					callback: function (userData, formData, next) {
						if (formData.gdpr_agree_data === 'on' && formData.gdpr_agree_email === 'on') {
							userData.gdpr_consent = true;
						}

						next(userData.gdpr_consent ? null : new Error('[[register:gdpr_consent_denied]]'));
					},
				});
				return data;
			},

			// Forum Terms of Use
			async function (data) {
				if (!data.userData) {
					throw new Error('[[error:invalid-data]]');
				}
				if (!meta.config.termsOfUse || data.userData.acceptTos) {
					// no ToS or ToS accepted, nothing to do
					return data;
				}

				if (data.userData.uid) {
					const accepted = await db.getObjectField('user:' + data.userData.uid, 'acceptTos');
					if (parseInt(accepted, 10)) {
						return data;
					}
				}

				const termsOfUse = await plugins.fireHook('filter:parse.post', {
					postData: {
						content: meta.config.termsOfUse || '',
					},
				});

				data.interstitials.push({
					template: 'partials/acceptTos',
					data: {
						termsOfUse: termsOfUse.postData.content,
					},
					callback: function (userData, formData, next) {
						if (formData['agree-terms'] === 'on') {
							userData.acceptTos = true;
						}

						next(userData.acceptTos ? null : new Error('[[register:terms_of_use_error]]'));
					},
				});
				return data;
			},
		],
	});

	callback();
};

require('../promisify')(User);
