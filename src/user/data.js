'use strict';

var async = require('async');
var validator = require('validator');
var nconf = require('nconf');
var winston = require('winston');

var db = require('../database');
var meta = require('../meta');
var plugins = require('../plugins');
var utils = require('../utils');

module.exports = function (User) {
	var iconBackgrounds = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
		'#009688', '#1b5e20', '#33691e', '#827717', '#e65100', '#ff5722', '#795548', '#607d8b'];

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

	User.getUsersFields = function (uids, fields, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var fieldsToRemove = [];
		function addField(field) {
			if (fields.indexOf(field) === -1) {
				fields.push(field);
				fieldsToRemove.push(field);
			}
		}

		if (fields.indexOf('uid') === -1) {
			fields.push('uid');
		}

		if (fields.indexOf('picture') !== -1) {
			addField('email');
			addField('uploadedpicture');
		}

		if (fields.indexOf('status') !== -1) {
			addField('lastonline');
		}

		var uniqueUids = uids.filter(function (uid, index) {
			return index === uids.indexOf(uid);
		});

		async.waterfall([
			function (next) {
				db.getObjectsFields(uidsToUserKeys(uniqueUids), fields, next);
			},
			function (users, next) {
				users = uidsToUsers(uids, uniqueUids, users);

				modifyUserData(users, fieldsToRemove, next);
			},
		], callback);
	};

	User.getMultipleUserFields = function (uids, fields, callback) {
		winston.warn('[deprecated] User.getMultipleUserFields is deprecated please use User.getUsersFields');
		User.getUsersFields(uids, fields, callback);
	};

	User.getUserData = function (uid, callback) {
		User.getUsersData([uid], function (err, users) {
			callback(err, users ? users[0] : null);
		});
	};

	User.getUsersData = function (uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var uniqueUids = uids.filter(function (uid, index) {
			return index === uids.indexOf(uid);
		});

		async.waterfall([
			function (next) {
				db.getObjects(uidsToUserKeys(uniqueUids), next);
			},
			function (users, next) {
				users = uidsToUsers(uids, uniqueUids, users);

				modifyUserData(users, [], next);
			},
		], callback);
	};

	function uidsToUsers(uids, uniqueUids, usersData) {
		var ref = uniqueUids.reduce(function (memo, cur, idx) {
			memo[cur] = idx;
			return memo;
		}, {});
		var users = uids.map(function (uid) {
			return usersData[ref[uid]];
		});
		return users;
	}

	function uidsToUserKeys(uids) {
		return uids.map(function (uid) {
			return 'user:' + uid;
		});
	}

	function modifyUserData(users, fieldsToRemove, callback) {
		users.forEach(function (user) {
			if (!user) {
				return;
			}

			if (user.hasOwnProperty('username')) {
				user.username = validator.escape(user.username ? user.username.toString() : '');
			}

			if (user.password) {
				user.password = undefined;
			}

			if (!parseInt(user.uid, 10)) {
				user.uid = 0;
				user.username = '[[global:guest]]';
				user.userslug = '';
				user.picture = User.getDefaultAvatar();
				user['icon:text'] = '?';
				user['icon:bgColor'] = '#aaa';
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

			if (user.hasOwnProperty('status') && parseInt(user.lastonline, 10)) {
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
		});

		plugins.fireHook('filter:users.get', users, callback);
	}

	User.getDefaultAvatar = function () {
		if (!meta.config.defaultAvatar) {
			return '';
		}
		return meta.config.defaultAvatar.startsWith('http') ? meta.config.defaultAvatar : nconf.get('relative_path') + meta.config.defaultAvatar;
	};

	User.setUserField = function (uid, field, value, callback) {
		callback = callback || function () {};
		async.waterfall([
			function (next) {
				db.setObjectField('user:' + uid, field, value, next);
			},
			function (next) {
				plugins.fireHook('action:user.set', { uid: uid, field: field, value: value, type: 'set' });
				next();
			},
		], callback);
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
