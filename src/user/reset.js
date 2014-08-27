
'use strict';

var async = require('async'),
	nconf = require('nconf'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/translator'),

	db = require('../database'),
	meta = require('../meta'),
	events = require('../events'),
	emailer = require('../emailer'),
	tran;

(function(UserReset) {

	UserReset.validate = function(socket, code, callback) {
		db.getObjectField('reset:uid', code, function(err, uid) {
			if (err || !uid) {
				return callback(err, false);
			}

			db.getObjectField('reset:expiry', code, function(err, expiry) {
				if (err) {
					return callback(err);
				}

				if (parseInt(expiry, 10) >= Date.now() / 1000) {
					callback(null, true);
				} else {
					// Expired, delete from db
					db.deleteObjectField('reset:uid', code);
					db.deleteObjectField('reset:expiry', code);
					callback(null, false);
				}
			});
		});
	};

	UserReset.send = function(socket, email, callback) {
		user.getUidByEmail(email, function(err, uid) {
			if (err || !uid) {
				return callback(err || new Error('[[error:invalid-email]]'));
			}

			var reset_code = utils.generateUUID();
			db.setObjectField('reset:uid', reset_code, uid);
			db.setObjectField('reset:expiry', reset_code, (60 * 60) + Math.floor(Date.now() / 1000));

			var reset_link = nconf.get('url') + '/reset/' + reset_code;

			translator.translate('[[email:password-reset-requested, ' + (meta.config.title || 'NodeBB') + ']]', meta.config.defaultLang, function(subject) {
				emailer.send('reset', uid, {
					site_title: (meta.config.title || 'NodeBB'),
					reset_link: reset_link,
					subject: subject,
					template: 'reset',
					uid: uid
				});
				callback();
			});
		});
	};

	UserReset.commit = function(socket, code, password, callback) {
		UserReset.validate(socket, code, function(err, validated) {
			if(err) {
				return callback(err);
			}

			if (!validated) {
				return;
			}

			db.getObjectField('reset:uid', code, function(err, uid) {
				if (err) {
					return callback(err);
				}

				user.hashPassword(password, function(err, hash) {
					if (err) {
						return callback(err);
					}
					user.setUserField(uid, 'password', hash);
					events.logPasswordReset(uid);

					db.deleteObjectField('reset:uid', code);
					db.deleteObjectField('reset:expiry', code);

					user.auth.resetLockout(uid, callback);
				});
			});
		});
	};

}(exports));
