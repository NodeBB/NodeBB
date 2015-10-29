'use strict';

var validator = require('validator');
var nconf = require('nconf');
var winston = require('winston');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function(User) {

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

			user.username = validator.escape(user.username);

			if (user.password) {
				user.password = undefined;
			}

			if (!parseInt(user.uid, 10)) {
				user.uid = 0;
				user.username = '[[global:guest]]';
				user.userslug = '';
				user.picture = '';
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
			var backgrounds = ['#AB4642', '#DC9656', '#A1B56C', '#7CAFC2', '#BA8BAF', '#A16946'];
			user['icon:text'] = (user.username[0] || '').toUpperCase();
			user['icon:bgColor'] = backgrounds[Array.prototype.reduce.call(user.username, function(cur, next) {
				return cur + next.charCodeAt();
			}, 0) % backgrounds.length];
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