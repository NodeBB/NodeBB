'use strict';

var async = require('async');
var validator = require('validator');
var nconf = require('nconf');
var winston = require('winston');
var _ = require('lodash');

var db = require('../database');
var meta = require('../meta');
var plugins = require('../plugins');
var utils = require('../utils');

const intFields = [
	'uid', 'postcount', 'topiccount', 'reputation', 'profileviews',
	'banned', 'banned:expire', 'email:confirmed', 'joindate', 'lastonline', 'lastqueuetime',
	'lastposttime', 'followingCount', 'followerCount',
];

module.exports = function (User) {
	var iconBackgrounds = [
		'#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
		'#009688', '#1b5e20', '#33691e', '#827717', '#e65100', '#ff5722',
		'#795548', '#607d8b',
	];

	var fieldWhitelist = [
		'uid', 'username', 'userslug', 'email', 'email:confirmed', 'joindate',
		'lastonline', 'picture', 'fullname', 'location', 'birthday', 'website',
		'aboutme', 'signature', 'uploadedpicture', 'profileviews', 'reputation',
		'postcount', 'topiccount', 'lastposttime', 'banned', 'banned:expire',
		'status', 'flags', 'followerCount', 'followingCount', 'cover:url',
		'cover:position', 'groupTitle',
	];

	User.guestData = {
		uid: 0,
		username: '[[global:guest]]',
		userslug: '',
		fullname: '[[global:guest]]',
		email: '',
		'icon:text': '?',
		'icon:bgColor': '#aaa',
		groupTitle: '',
		status: 'offline',
		reputation: 0,
		'email:confirmed': 0,
	};

	User.getUsersFields = function (uids, fields, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return setImmediate(callback, null, []);
		}

		uids = uids.map(uid => (isNaN(uid) ? 0 : parseInt(uid, 10)));

		var fieldsToRemove = [];
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

		var uniqueUids = _.uniq(uids).filter(uid => uid > 0);

		async.waterfall([
			function (next) {
				plugins.fireHook('filter:user.whitelistFields', { uids: uids, whitelist: fieldWhitelist.slice() }, next);
			},
			function (results, next) {
				if (fields.length) {
					const whitelistSet = new Set(results.whitelist);
					fields = fields.filter(function (field) {
						var isFieldWhitelisted = field && whitelistSet.has(field);
						if (!isFieldWhitelisted) {
							winston.verbose('[user/getUsersFields] ' + field + ' removed because it is not whitelisted, see `filter:user.whitelistFields`');
						}
						return isFieldWhitelisted;
					});
				} else {
					fields = results.whitelist;
				}

				db.getObjectsFields(uidsToUserKeys(uniqueUids), fields, next);
			},
			function (users, next) {
				users = uidsToUsers(uids, uniqueUids, users);

				modifyUserData(users, fields, fieldsToRemove, next);
			},
		], callback);
	};


	User.getUserField = function (uid, field, callback) {
		User.getUserFields(uid, [field], function (err, user) {
			callback(err, user ? user[field] : null);
		});
	};

	User.getUserFields = function (uid, fields, callback) {
		User.getUsersFields([uid], fields, function (err, users) {
			callback(err, users ? users[0] : null);
		});
	};

	User.getUserData = function (uid, callback) {
		User.getUsersData([uid], function (err, users) {
			callback(err, users ? users[0] : null);
		});
	};

	User.getUsersData = function (uids, callback) {
		User.getUsersFields(uids, [], callback);
	};

	function uidsToUsers(uids, uniqueUids, usersData) {
		var uidToUser = uniqueUids.reduce(function (memo, uid, idx) {
			memo[uid] = usersData[idx];
			return memo;
		}, {});
		var users = uids.map(function (uid) {
			const returnPayload = uidToUser[uid] || _.clone(User.guestData);
			if (uid > 0 && !returnPayload.uid) {
				returnPayload.oldUid = parseInt(uid, 10);
			}

			return returnPayload;
		});
		return users;
	}

	function uidsToUserKeys(uids) {
		return uids.map(uid => 'user:' + uid);
	}

	function modifyUserData(users, requestedFields, fieldsToRemove, callback) {
		users.forEach(function (user) {
			if (!user) {
				return;
			}

			db.parseIntFields(user, intFields, requestedFields);

			if (user.hasOwnProperty('username')) {
				user.username = validator.escape(user.username ? user.username.toString() : '');
			}

			if (user.hasOwnProperty('email')) {
				user.email = validator.escape(user.email ? user.email.toString() : '');
			}

			if (!parseInt(user.uid, 10)) {
				user.uid = 0;
				user.username = (user.hasOwnProperty('oldUid') && parseInt(user.oldUid, 10)) ? '[[global:former_user]]' : '[[global:guest]]';
				user.userslug = '';
				user.picture = User.getDefaultAvatar();
				user['icon:text'] = '?';
				user['icon:bgColor'] = '#aaa';
				user.groupTitle = '';
			}

			if (user.hasOwnProperty('groupTitle')) {
				parseGroupTitle(user);
			}

			if (user.picture && user.picture === user.uploadedpicture) {
				user.uploadedpicture = user.picture.startsWith('http') ? user.picture : nconf.get('relative_path') + user.picture;
				user.picture = user.uploadedpicture;
			} else if (user.uploadedpicture) {
				user.uploadedpicture = user.uploadedpicture.startsWith('http') ? user.uploadedpicture : nconf.get('relative_path') + user.uploadedpicture;
			}
			if (meta.config.defaultAvatar && !user.picture) {
				user.picture = User.getDefaultAvatar();
			}

			if (user.hasOwnProperty('status') && user.lastonline) {
				user.status = User.getStatus(user);
			}

			for (var i = 0; i < fieldsToRemove.length; i += 1) {
				user[fieldsToRemove[i]] = undefined;
			}

			// User Icons
			if (user.hasOwnProperty('picture') && user.username && parseInt(user.uid, 10) && !meta.config.defaultAvatar) {
				user['icon:text'] = (user.username[0] || '').toUpperCase();
				user['icon:bgColor'] = iconBackgrounds[Array.prototype.reduce.call(user.username, function (cur, next) {
					return cur + next.charCodeAt();
				}, 0) % iconBackgrounds.length];
			}

			if (user.hasOwnProperty('joindate')) {
				user.joindateISO = utils.toISOString(user.joindate);
			}

			if (user.hasOwnProperty('lastonline')) {
				user.lastonlineISO = utils.toISOString(user.lastonline) || user.joindateISO;
			}

			if (user.hasOwnProperty('banned:expire')) {
				user.banned_until = user['banned:expire'];
				user.banned_until_readable = user.banned_until ? new Date(user.banned_until).toString() : 'Not Banned';
			}
		});

		plugins.fireHook('filter:users.get', users, callback);
	}

	function parseGroupTitle(user) {
		try {
			user.groupTitleArray = JSON.parse(user.groupTitle);
		} catch (err) {
			if (user.groupTitle) {
				user.groupTitleArray = [user.groupTitle];
			} else {
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

	User.getDefaultAvatar = function () {
		if (!meta.config.defaultAvatar) {
			return '';
		}
		return meta.config.defaultAvatar.startsWith('http') ? meta.config.defaultAvatar : nconf.get('relative_path') + meta.config.defaultAvatar;
	};

	User.setUserField = function (uid, field, value, callback) {
		User.setUserFields(uid, { [field]: value }, callback);
	};

	User.setUserFields = function (uid, data, callback) {
		callback = callback || function () {};
		async.waterfall([
			function (next) {
				db.setObject('user:' + uid, data, next);
			},
			function (next) {
				for (var field in data) {
					if (data.hasOwnProperty(field)) {
						plugins.fireHook('action:user.set', { uid: uid, field: field, value: data[field], type: 'set' });
					}
				}
				next();
			},
		], callback);
	};

	User.incrementUserFieldBy = function (uid, field, value, callback) {
		incrDecrUserFieldBy(uid, field, value, 'increment', callback);
	};

	User.decrementUserFieldBy = function (uid, field, value, callback) {
		incrDecrUserFieldBy(uid, field, -value, 'decrement', callback);
	};

	function incrDecrUserFieldBy(uid, field, value, type, callback) {
		callback = callback || function () {};
		async.waterfall([
			function (next) {
				db.incrObjectFieldBy('user:' + uid, field, value, next);
			},
			function (value, next) {
				plugins.fireHook('action:user.set', { uid: uid, field: field, value: value, type: type });

				next(null, value);
			},
		], callback);
	}
};
