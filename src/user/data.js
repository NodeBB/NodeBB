'use strict';

const validator = require('validator');
const nconf = require('nconf');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const utils = require('../utils');

const relative_path = nconf.get('relative_path');

const intFields = [
	'uid', 'postcount', 'topiccount', 'reputation', 'profileviews',
	'banned', 'banned:expire', 'email:confirmed', 'joindate', 'lastonline',
	'lastqueuetime', 'lastposttime', 'followingCount', 'followerCount',
	'blocksCount', 'passwordExpiry', 'mutedUntil',
];

module.exports = function (User) {
	const fieldWhitelist = [
		'uid', 'username', 'userslug', 'email', 'email:confirmed', 'joindate',
		'lastonline', 'picture', 'icon:bgColor', 'fullname', 'location', 'birthday', 'website',
		'aboutme', 'signature', 'uploadedpicture', 'profileviews', 'reputation',
		'postcount', 'topiccount', 'lastposttime', 'banned', 'banned:expire',
		'status', 'flags', 'followerCount', 'followingCount', 'cover:url',
		'cover:position', 'groupTitle', 'mutedUntil', 'mutedReason',
	];

	User.guestData = {
		uid: 0,
		username: '[[global:guest]]',
		displayname: '[[global:guest]]',
		userslug: '',
		fullname: '[[global:guest]]',
		email: '',
		'icon:text': '?',
		'icon:bgColor': '#aaa',
		groupTitle: '',
		groupTitleArray: [],
		status: 'offline',
		reputation: 0,
		'email:confirmed': 0,
	};

	let iconBackgrounds;

	User.getUsersFields = async function (uids, fields) {
		if (!Array.isArray(uids) || !uids.length) {
			return [];
		}

		uids = uids.map(uid => (isNaN(uid) ? 0 : parseInt(uid, 10)));

		const fieldsToRemove = [];
		fields = fields.slice();
		ensureRequiredFields(fields, fieldsToRemove);

		const uniqueUids = _.uniq(uids).filter(uid => uid > 0);

		const results = await plugins.hooks.fire('filter:user.whitelistFields', {
			uids: uids,
			whitelist: fieldWhitelist.slice(),
		});
		if (!fields.length) {
			fields = results.whitelist;
		} else {
			// Never allow password retrieval via this method
			fields = fields.filter(value => value !== 'password');
		}

		const users = await db.getObjectsFields(uniqueUids.map(uid => `user:${uid}`), fields);
		const result = await plugins.hooks.fire('filter:user.getFields', {
			uids: uniqueUids,
			users: users,
			fields: fields,
		});
		result.users.forEach((user, index) => {
			if (uniqueUids[index] > 0 && !user.uid) {
				user.oldUid = uniqueUids[index];
			}
		});
		await modifyUserData(result.users, fields, fieldsToRemove);
		return uidsToUsers(uids, uniqueUids, result.users);
	};

	function ensureRequiredFields(fields, fieldsToRemove) {
		function addField(field) {
			if (!fields.includes(field)) {
				fields.push(field);
				fieldsToRemove.push(field);
			}
		}

		if (fields.length && !fields.includes('uid')) {
			fields.push('uid');
		}

		if (fields.includes('picture')) {
			addField('uploadedpicture');
		}

		if (fields.includes('status')) {
			addField('lastonline');
		}

		if (fields.includes('banned') && !fields.includes('banned:expire')) {
			addField('banned:expire');
		}

		if (fields.includes('username') && !fields.includes('fullname')) {
			addField('fullname');
		}
	}

	function uidsToUsers(uids, uniqueUids, usersData) {
		const uidToUser = _.zipObject(uniqueUids, usersData);
		const users = uids.map((uid) => {
			const user = uidToUser[uid] || { ...User.guestData };
			if (!parseInt(user.uid, 10)) {
				user.username = (user.hasOwnProperty('oldUid') && parseInt(user.oldUid, 10)) ? '[[global:former-user]]' : '[[global:guest]]';
				user.displayname = user.username;
			}
			if (uid === -1) { // if loading spider set uid to -1 otherwise spiders have uid = 0 like guests
				user.uid = -1;
			}
			return user;
		});
		return users;
	}

	User.getUserField = async function (uid, field) {
		const user = await User.getUserFields(uid, [field]);
		return user ? user[field] : null;
	};

	User.getUserFields = async function (uid, fields) {
		const users = await User.getUsersFields([uid], fields);
		return users ? users[0] : null;
	};

	User.getUserData = async function (uid) {
		const users = await User.getUsersData([uid]);
		return users ? users[0] : null;
	};

	User.getUsersData = async function (uids) {
		return await User.getUsersFields(uids, []);
	};

	User.hidePrivateData = async function (users, callerUID) {
		let single = false;
		if (!Array.isArray(users)) {
			users = [users];
			single = true;
		}

		const [userSettings, isAdmin, isGlobalModerator] = await Promise.all([
			User.getMultipleUserSettings(users.map(user => user.uid)),
			User.isAdministrator(callerUID),
			User.isGlobalModerator(callerUID),
		]);

		users = await Promise.all(users.map(async (userData, idx) => {
			const _userData = { ...userData };

			const isSelf = parseInt(callerUID, 10) === parseInt(_userData.uid, 10);
			const privilegedOrSelf = isAdmin || isGlobalModerator || isSelf;

			if (!privilegedOrSelf && (!userSettings[idx].showemail || meta.config.hideEmail)) {
				_userData.email = '';
			}
			if (!privilegedOrSelf && (!userSettings[idx].showfullname || meta.config.hideFullname)) {
				_userData.fullname = '';
			}
			return _userData;
		}));

		return single ? users.pop() : users;
	};

	async function modifyUserData(users, requestedFields, fieldsToRemove) {
		let uidToSettings = {};
		if (meta.config.showFullnameAsDisplayName) {
			const uids = users.map(user => user.uid);
			uidToSettings = _.zipObject(uids, await db.getObjectsFields(
				uids.map(uid => `user:${uid}:settings`),
				['showfullname']
			));
		}
		if (!iconBackgrounds) {
			iconBackgrounds = await User.getIconBackgrounds();
		}

		const unbanUids = [];
		users.forEach((user) => {
			if (!user) {
				return;
			}

			db.parseIntFields(user, intFields, requestedFields);

			if (user.hasOwnProperty('username')) {
				parseDisplayName(user, uidToSettings);
				user.username = validator.escape(user.username ? user.username.toString() : '');
			}

			if (user.hasOwnProperty('email')) {
				user.email = validator.escape(user.email ? user.email.toString() : '');
			}

			if (!user.uid) {
				for (const [key, value] of Object.entries(User.guestData)) {
					user[key] = value;
				}
				user.picture = User.getDefaultAvatar();
			}

			if (user.hasOwnProperty('groupTitle')) {
				parseGroupTitle(user);
			}

			if (user.picture && user.picture === user.uploadedpicture) {
				user.uploadedpicture = user.picture.startsWith('http') ? user.picture : relative_path + user.picture;
				user.picture = user.uploadedpicture;
			} else if (user.uploadedpicture) {
				user.uploadedpicture = user.uploadedpicture.startsWith('http') ? user.uploadedpicture : relative_path + user.uploadedpicture;
			}
			if (meta.config.defaultAvatar && !user.picture) {
				user.picture = User.getDefaultAvatar();
			}

			if (user.hasOwnProperty('status') && user.hasOwnProperty('lastonline')) {
				user.status = User.getStatus(user);
			}

			for (let i = 0; i < fieldsToRemove.length; i += 1) {
				user[fieldsToRemove[i]] = undefined;
			}

			// User Icons
			if (requestedFields.includes('picture') && user.username && user.uid && !meta.config.defaultAvatar) {
				if (!iconBackgrounds.includes(user['icon:bgColor'])) {
					const nameAsIndex = Array.from(user.username).reduce((cur, next) => cur + next.charCodeAt(), 0);
					user['icon:bgColor'] = iconBackgrounds[nameAsIndex % iconBackgrounds.length];
				}
				user['icon:text'] = (user.username[0] || '').toUpperCase();
			}

			if (user.hasOwnProperty('joindate')) {
				user.joindateISO = utils.toISOString(user.joindate);
			}

			if (user.hasOwnProperty('lastonline')) {
				user.lastonlineISO = utils.toISOString(user.lastonline) || user.joindateISO;
			}

			if (user.hasOwnProperty('mutedUntil')) {
				user.muted = user.mutedUntil > Date.now();
			}

			if (user.hasOwnProperty('banned') || user.hasOwnProperty('banned:expire')) {
				const result = User.bans.calcExpiredFromUserData(user);
				user.banned = result.banned;
				const unban = result.banned && result.banExpired;
				user.banned_until = unban ? 0 : user['banned:expire'];
				user.banned_until_readable = user.banned_until && !unban ? utils.toISOString(user.banned_until) : 'Not Banned';
				if (unban) {
					unbanUids.push(user.uid);
					user.banned = false;
				}
			}
		});
		if (unbanUids.length) {
			await User.bans.unban(unbanUids, '[[user:info.ban-expired]]');
		}

		return await plugins.hooks.fire('filter:users.get', users);
	}

	function parseDisplayName(user, uidToSettings) {
		let showfullname = parseInt(meta.config.showfullname, 10) === 1;
		if (uidToSettings[user.uid]) {
			if (parseInt(uidToSettings[user.uid].showfullname, 10) === 0) {
				showfullname = false;
			} else if (parseInt(uidToSettings[user.uid].showfullname, 10) === 1) {
				showfullname = true;
			}
		}

		user.displayname = validator.escape(String(
			meta.config.showFullnameAsDisplayName && showfullname && user.fullname ?
				user.fullname :
				user.username
		));
	}

	function parseGroupTitle(user) {
		try {
			user.groupTitleArray = JSON.parse(user.groupTitle);
		} catch (err) {
			if (user.groupTitle) {
				user.groupTitleArray = [user.groupTitle];
			} else {
				user.groupTitle = '';
				user.groupTitleArray = [];
			}
		}
		if (!Array.isArray(user.groupTitleArray)) {
			if (user.groupTitleArray) {
				user.groupTitleArray = [user.groupTitleArray];
			} else {
				user.groupTitleArray = [];
			}
		}
		if (!meta.config.allowMultipleBadges && user.groupTitleArray.length) {
			user.groupTitleArray = [user.groupTitleArray[0]];
		}
	}


	User.getIconBackgrounds = async () => {
		if (iconBackgrounds) {
			return iconBackgrounds;
		}

		const _iconBackgrounds = [
			'#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
			'#009688', '#1b5e20', '#33691e', '#827717', '#e65100', '#ff5722',
			'#795548', '#607d8b',
		];

		const data = await plugins.hooks.fire('filter:user.iconBackgrounds', { iconBackgrounds: _iconBackgrounds });
		iconBackgrounds = data.iconBackgrounds;
		return iconBackgrounds;
	};

	User.getDefaultAvatar = function () {
		if (!meta.config.defaultAvatar) {
			return '';
		}
		return meta.config.defaultAvatar.startsWith('http') ? meta.config.defaultAvatar : relative_path + meta.config.defaultAvatar;
	};

	User.setUserField = async function (uid, field, value) {
		await User.setUserFields(uid, { [field]: value });
	};

	User.setUserFields = async function (uid, data) {
		await db.setObject(`user:${uid}`, data);
		for (const [field, value] of Object.entries(data)) {
			plugins.hooks.fire('action:user.set', { uid, field, value, type: 'set' });
		}
	};

	User.incrementUserFieldBy = async function (uid, field, value) {
		return await incrDecrUserFieldBy(uid, field, value, 'increment');
	};

	User.decrementUserFieldBy = async function (uid, field, value) {
		return await incrDecrUserFieldBy(uid, field, -value, 'decrement');
	};

	async function incrDecrUserFieldBy(uid, field, value, type) {
		const newValue = await db.incrObjectFieldBy(`user:${uid}`, field, value);
		plugins.hooks.fire('action:user.set', { uid: uid, field: field, value: newValue, type: type });
		return newValue;
	}
};
