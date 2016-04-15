'use strict';

var validator = require('validator');
var nconf = require('nconf');
var winston = require('winston');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function(User) {

	var iconBackgrounds = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3',
		'#009688', '#1b5e20', '#33691e', '#827717', '#e65100', '#ff5722', '#795548', '#607d8b'];

	User.getUserField = function(uid, field, callback) {
		User.getUserFields(uid, [field], function(err, user) {
			callback(err, user ? user[field] : null);
		});
	};

	User.getUserFields = function(uid, fields, callback) {
		User.getUsersFields([uid], fields, function(err, users) {
			callback(err, users ? users[0] : null);
		});
	};

	User.getUsersFields = function(uids, fields, callback) {
		var fieldsToRemove = [];
		function addField(field) {
			if (fields.indexOf(field) === -1) {
				fields.push(field);
				fieldsToRemove.push(field);
			}
		}

		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var keys = uids.map(function(uid) {
			return 'user:' + uid;
		});

		if (fields.indexOf('uid') === -1) {
			fields.push('uid');
		}

		if (fields.indexOf('picture') !== -1) {
			addField('email');
			addField('uploadedpicture');
		}

		db.getObjectsFields(keys, fields, function(err, users) {
			if (err) {
				return callback(err);
			}

			modifyUserData(users, fieldsToRemove, callback);
		});
	};

	User.getMultipleUserFields = function(uids, fields, callback) {
		winston.warn('[deprecated] User.getMultipleUserFields is deprecated please use User.getUsersFields');
		User.getUsersFields(uids, fields, callback);
	};

	User.getUserData = function(uid, callback) {
		User.getUsersData([uid], function(err, users) {
			callback(err, users ? users[0] : null);
		});
	};

	User.getUsersData = function(uids, callback) {
		if (!Array.isArray(uids) || !uids.length) {
			return callback(null, []);
		}

		var keys = uids.map(function(uid) {
			return 'user:' + uid;
		});

		db.getObjects(keys, function(err, users) {
			if (err) {
				return callback(err);
			}

			modifyUserData(users, [], callback);
		});
	};

	function modifyUserData(users, fieldsToRemove, callback) {
		users.forEach(function(user) {
			if (!user) {
				return;
			}

			user.username = validator.escape(user.username ? user.username.toString() : '');

			if (user.password) {
				user.password = undefined;
			}

			if (!parseInt(user.uid, 10)) {
				user.uid = 0;
				user.username = '[[global:guest]]';
				user.userslug = '';
				user.picture = '';
				user['icon:text'] = '?';
				user['icon:bgColor'] = '#aaa';
			}

			if (user.picture && user.picture === user.uploadedpicture) {
				user.picture = user.uploadedpicture = user.picture.startsWith('http') ? user.picture : nconf.get('relative_path') + user.picture;
			} else if (user.uploadedpicture) {
				user.uploadedpicture = user.uploadedpicture.startsWith('http') ? user.uploadedpicture : nconf.get('relative_path') + user.uploadedpicture;
			}

			for(var i=0; i<fieldsToRemove.length; ++i) {
				user[fieldsToRemove[i]] = undefined;
			}

			// User Icons
			if (user.hasOwnProperty('picture') && user.username && parseInt(user.uid, 10)) {
				user['icon:text'] = (user.username[0] || '').toUpperCase();
				user['icon:bgColor'] = iconBackgrounds[Array.prototype.reduce.call(user.username, function(cur, next) {
					return cur + next.charCodeAt();
				}, 0) % iconBackgrounds.length];
			}
		});

		plugins.fireHook('filter:users.get', users, callback);
	}

	User.setUserField = function(uid, field, value, callback) {
		callback = callback || function() {};
		db.setObjectField('user:' + uid, field, value, function(err) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:user.set', {uid: uid, field: field, value: value, type: 'set'});
			callback();
		});
	};

	User.setUserFields = function(uid, data, callback) {
		callback = callback || function() {};
		db.setObject('user:' + uid, data, function(err) {
			if (err) {
				return callback(err);
			}
			for (var field in data) {
				if (data.hasOwnProperty(field)) {
					plugins.fireHook('action:user.set', {uid: uid, field: field, value: data[field], type: 'set'});
				}
			}
			callback();
		});
	};

	User.incrementUserFieldBy = function(uid, field, value, callback) {
		callback = callback || function() {};
		db.incrObjectFieldBy('user:' + uid, field, value, function(err, value) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:user.set', {uid: uid, field: field, value: value, type: 'increment'});

			callback(null, value);
		});
	};

	User.decrementUserFieldBy = function(uid, field, value, callback) {
		callback = callback || function() {};
		db.incrObjectFieldBy('user:' + uid, field, -value, function(err, value) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('action:user.set', {uid: uid, field: field, value: value, type: 'decrement'});

			callback(null, value);
		});
	};

};