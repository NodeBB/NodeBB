'use strict';

const validator = require('validator');
const nconf = require('nconf');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const categories = require('../categories');
const activitypub = require('../activitypub');
const utils = require('../utils');
const coverPhoto = require('../coverPhoto');
const translator = require('../translator');

const relative_path = nconf.get('relative_path');
const upload_url = nconf.get('upload_url');

const prependRelativePath = url => url.startsWith('http') ? url : relative_path + url;

const intFields = [
	'uid', 'postcount', 'topiccount', 'reputation', 'profileviews',
	'banned', 'banned:expire', 'email:confirmed', 'joindate', 'lastonline',
	'lastqueuetime', 'lastposttime', 'followingCount', 'followerCount',
	'blocksCount', 'passwordExpiry', 'muted', 'mutedUntil', 'flags',
];

module.exports = function (User) {
	const fieldWhitelist = [
		'uid', 'username', 'userslug', 'url', 'email', 'email:confirmed', 'joindate',
		'lastonline', 'picture', 'icon:bgColor', 'fullname', 'birthday',
		'aboutme', 'signature', 'uploadedpicture', 'profileviews', 'reputation',
		'postcount', 'topiccount', 'lastposttime', 'banned', 'banned:expire',
		'status', 'flags', 'followerCount', 'followingCount', 'cover:url',
		'cover:position', 'groupTitle', 'muted', 'mutedUntil', 'mutedReason',
	];

	let customFieldWhiteList = null;
	const escapeFieldList = [
		'email', 'username', 'fullname', 'signature', 'displayname',
		'cover:position', 'birthday', 'aboutme',
	];
	const urlFieldList = [
		'picture', 'cover:url',
	];

	User.allowedStatus = ['online', 'offline', 'dnd', 'away'];

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

	User.reloadCustomFieldWhitelist = async () => {
		customFieldWhiteList = await db.getSortedSetRange('user-custom-fields', 0, -1);
	};

	User.getUserFieldWhitelist = async function () {
		const { whitelist } = await plugins.hooks.fire('filter:user.whitelistFields', {
			uids: [],
			whitelist: fieldWhitelist.slice(),
		});
		return whitelist;
	};

	User.getUsersFields = async function (uids, fields) {
		if (!Array.isArray(uids) || !uids.length) {
			return [];
		}

		uids = uids.map((uid) => {
			if (utils.isNumber(uid)) {
				return parseInt(uid, 10);
			} else if (activitypub.helpers.isUri(uid)) {
				return uid;
			}

			return 0;
		});

		const fieldsToRemove = [];
		fields = fields.slice();
		ensureRequiredFields(fields, fieldsToRemove);

		const uniqueUids = _.uniq(uids).filter(uid => isFinite(uid) && uid > 0);
		const remoteIds = _.uniq(uids).filter(uid => !isFinite(uid));

		if (!customFieldWhiteList) {
			await User.reloadCustomFieldWhitelist();
		}

		const results = await plugins.hooks.fire('filter:user.whitelistFields', {
			uids: uids,
			whitelist: _.uniq(fieldWhitelist.concat(customFieldWhiteList)),
		});
		if (!fields.length) {
			fields = results.whitelist;
		} else {
			fields = fields.filter(value => value !== 'password');
		}

		let users = await db.getObjectsFields(
			uniqueUids.map(uid => `user:${uid}`).concat(remoteIds.map(id => `userRemote:${id}`)),
			fields
		);

		// Handle when some remoteIds are group actors
		const combinedUids = uniqueUids.concat(remoteIds);
		let remoteCids = await categories.exists(remoteIds);
		remoteCids = remoteCids
			.map((exists, idx) => exists ? remoteIds[idx] : null)
			.filter(Boolean);
		if (remoteCids.length) {
			let categoryData = await categories.getCategoriesFields(remoteCids, ['cid', 'slug', 'name', 'backgroundImage']);
			categoryData = categoryData.reduce((map, categoryObj) => {
				map.set(categoryObj.cid, categoryObj);
				return map;
			}, new Map());
			users = users.map((userObj, idx) => {
				const cid = combinedUids[idx];
				if (remoteCids.includes(cid)) {
					const categoryObj = categoryData.get(cid);
					userObj = {
						...userObj,
						...(userObj.hasOwnProperty('uid') && { uid: categoryObj.cid }),
						...(userObj.hasOwnProperty('username') && { username: categoryObj.name }),
						...(userObj.hasOwnProperty('userslug') && { userslug: `../category/${categoryObj.slug}` }),
						...(userObj.hasOwnProperty('displayname') && { displayname: categoryObj.name }),
						...(userObj.hasOwnProperty('picture') && { picture: categoryObj.backgroundImage }),
					};
				}

				return userObj;
			});
		}

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
		return uidsToUsers(uids, [...uniqueUids, ...remoteIds], result.users);
	};

	function ensureRequiredFields(fields, fieldsToRemove) {
		if (fields.length && !fields.includes('uid')) {
			fields.push('uid');
		}

		const requiredFields = {
			picture: 'uploadedpicture',
			status: 'lastonline',
			banned: 'banned:expire',
			'banned:expire': 'banned',
			username: 'fullname',
			muted: 'mutedUntil',
			mutedUntil: 'muted',
		};
		for (const [key, field] of Object.entries(requiredFields)) {
			if (fields.includes(key) && !fields.includes(field)) {
				fields.push(field);
				fieldsToRemove.push(field);
			}
		}
		if (fields.includes('picture') && !fields.includes('icon:bgColor')) {
			fields.push('icon:bgColor');
		}
	}

	function uidsToUsers(uids, uniqueUids, usersData) {
		const uidToUser = _.zipObject(uniqueUids, usersData);
		const users = uids.map((uid) => {
			const user = uidToUser[uid] || { ...User.guestData };
			if (!parseInt(user.uid, 10) && !activitypub.helpers.isUri(user.uid)) {
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
		return user && user.hasOwnProperty(field) ? user[field] : null;
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
		const unmuteUids = [];
		users.forEach((user) => {
			if (!user) {
				return;
			}

			db.parseIntFields(user, intFields, requestedFields);

			if (user.hasOwnProperty('username')) {
				parseDisplayName(user, uidToSettings);
				user.username = String(user.username || '');
			}

			// works around renderOverride supplying `url` to templates
			if (user.url) {
				user.remoteUrl = validator.escape(user.url);
			} else {
				delete user.url;
			}

			if (user.hasOwnProperty('email')) {
				user.email = String(user.email || '');
			}

			if (!user.uid && !activitypub.helpers.isUri(user.uid)) {
				for (const [key, value] of Object.entries(User.guestData)) {
					user[key] = value;
				}
				user.picture = User.getDefaultAvatar();
			}

			if (user.hasOwnProperty('groupTitle')) {
				parseGroupTitle(user);
			}
			const isUsingUploadedPicture = user.picture && user.picture === user.uploadedpicture;
			if (isUsingUploadedPicture || user.uploadedpicture) {
				user.uploadedpicture = prependRelativePath(user.uploadedpicture);
				if (isUsingUploadedPicture) {
					user.picture = user.uploadedpicture;
				}
			}

			if (user.hasOwnProperty('cover:url')) {
				user['cover:url'] = user['cover:url'] ?
					prependRelativePath(user['cover:url']) :
					coverPhoto.getDefaultProfileCover(user.uid);
			}

			if (meta.config.defaultAvatar && !user.picture) {
				user.picture = User.getDefaultAvatar();
			}

			if (user.hasOwnProperty('status') && user.hasOwnProperty('lastonline')) {
				user.status = User.getStatus(user);
			}

			if (user.hasOwnProperty('joindate')) {
				user.joindateISO = utils.toISOString(user.joindate);
			}

			if (user.hasOwnProperty('lastonline') && (!requestedFields.length || requestedFields.includes('lastonline')) && !fieldsToRemove.includes('lastonline')) {
				user.lastonlineISO = utils.toISOString(user.lastonline) || user.joindateISO;
			}

			if (user.hasOwnProperty('muted') && user.hasOwnProperty('mutedUntil')) {
				const isMuted = Boolean(user.muted);
				user.muted = Boolean(user.muted && (user.mutedUntil > Date.now() || user.mutedUntil === 0));
				const unmute = !user.muted && isMuted && user.mutedUntil && user.mutedUntil <= Date.now();
				if (unmute) {
					unmuteUids.push(user.uid);
				}
				user.mutedUntil = !user.muted ? 0 : user.mutedUntil;
				if (user.muted) {
					user.muted_until_readable = user.mutedUntil === 0 ?
						'[[user:info.muted-permanently]]' :
						utils.toISOString(user.mutedUntil);
				}
			}

			user.isLocal = utils.isNumber(user.uid);

			// User Icons
			if (requestedFields.includes('picture') && user.username && user.uid !== 0 && !meta.config.defaultAvatar) {
				if (!iconBackgrounds.includes(user['icon:bgColor'])) {
					const nameAsIndex = Array.from(user.username).reduce((cur, next) => cur + next.charCodeAt(), 0);
					user['icon:bgColor'] = iconBackgrounds[nameAsIndex % iconBackgrounds.length];
				}
				user['icon:text'] = (user.username[0] || '').toUpperCase();
			}

			if (user.hasOwnProperty('banned') && user.hasOwnProperty('banned:expire')) {
				const result = User.bans.calcExpiredFromUserData(user);
				user.banned = result.banned;
				const unban = result.banned && result.banExpired;
				user.banned_until = unban ? 0 : user['banned:expire'];
				user.banned_until_readable = user.banned_until && !unban ? utils.toISOString(user.banned_until) : '[[user:info.banned-permanently]]';
				if (unban) {
					unbanUids.push(user.uid);
					user.banned = false;
				}
			}
		});

		users.forEach((user) => {
			// remove fields that were added just for processing
			fieldsToRemove.forEach((field) => {
				if (user) {
					user[field] = undefined;
				}
			});

			escapeFieldList.forEach((field) => {
				if (user[field] && typeof user[field] === 'string') {
					user[field] = translator.escape(validator.escape(String(user[field])));
				}
			});
			urlFieldList.forEach((field) => {
				if (user[field] && typeof user[field] === 'string') {
					const trimmedValue = user[field].trim();
					user[field] = isValidUserUrlField(trimmedValue) ? translator.escape(validator.escape(trimmedValue)) : '';
				}
			});
		});

		await Promise.all([
			unbanUids.length ? User.bans.unban(unbanUids, '[[user:info.ban-expired]]') : null,
			unmuteUids.length ? db.sortedSetRemove('users:muted', unmuteUids) : null,
		]);

		return await plugins.hooks.fire('filter:users.get', users);
	}

	function isValidUserUrlField(value) {
		const trimmedValue = String(value).trim();
		const isHttpUrl = validator.isURL(trimmedValue, {
			require_protocol: true,
			require_valid_protocol: true,
			protocols: ['http', 'https'],
			require_tld: false,
		});

		if (isHttpUrl || trimmedValue.startsWith(upload_url)) {
			return true;
		}

		if (relative_path && trimmedValue.startsWith(relative_path)) {
			return trimmedValue.slice(relative_path.length).startsWith(upload_url);
		}

		return false;
	};

	function parseDisplayName(user, uidToSettings) {
		let showfullname = parseInt(meta.config.showfullname, 10) === 1;
		if (uidToSettings[user.uid]) {
			const userSetting = parseInt(uidToSettings[user.uid].showfullname, 10);
			if (userSetting === 0 || userSetting === 1) {
				showfullname = userSetting === 1;
			}
		}

		// Always show full name for remote users
		if (!utils.isNumber(user.uid)) {
			showfullname = true;
		}

		user.displayname = String(
			meta.config.showFullnameAsDisplayName && showfullname && user.fullname ?
				utils.stripBidiControls(user.fullname) :
				user.username
		);
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
			'#795548', '#607d8b', '#00bcd4', '#ffc107', '#8bc34a', '#9e9e9e',
			'#004d40', '#ad1457',
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
		const userKey = isFinite(uid) ? `user:${uid}` : `userRemote:${uid}`;
		await db.setObject(userKey, data);
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
		const prefix = `user${activitypub.helpers.isUri(uid) ? 'Remote' : ''}`;
		const newValue = await db.incrObjectFieldBy(`${prefix}:${uid}`, field, value);
		plugins.hooks.fire('action:user.set', { uid: uid, field: field, value: newValue, type: type });
		return newValue;
	}
};
