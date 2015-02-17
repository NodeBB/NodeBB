'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/translator'),

	db = require('../database'),
	meta = require('../meta'),
	events = require('../events'),
	emailer = require('../emailer');

(function(UserReset) {
	UserReset.validate = function(code, callback) {
		db.getObjectField('reset:uid', code, function(err, uid) {
			if (err || !uid) {
				return callback(err, false);
			}

			db.sortedSetScore('reset:issueDate', code, function(err, issueDate) {
				// db.getObjectField('reset:expiry', code, function(err, expiry) {
				if (err) {
					return callback(err);
				}

				callback(null, parseInt(issueDate, 10) > (Date.now() - (1000*60*120)));
			});
		});
	};

	UserReset.send = function(email, callback) {
		user.getUidByEmail(email, function(err, uid) {
			if (err || !uid) {
				return callback(err || new Error('[[error:invalid-email]]'));
			}

			var reset_code = utils.generateUUID();
			db.setObjectField('reset:uid', reset_code, uid);
			db.sortedSetAdd('reset:issueDate', Date.now(), reset_code);

			var reset_link = nconf.get('url') + '/reset/' + reset_code;

			translator.translate('[[email:password-reset-requested, ' + (meta.config.title || 'NodeBB') + ']]', meta.config.defaultLang, function(subject) {
				emailer.send('reset', uid, {
					site_title: (meta.config.title || 'NodeBB'),
					reset_link: reset_link,
					subject: subject,
					template: 'reset',
					uid: uid
				});
				callback(null, reset_code);
			});
		});
	};

	UserReset.commit = function(code, password, callback) {
		UserReset.validate(code, function(err, validated) {
			if(err) {
				return callback(err);
			}

			if (!validated) {
				return callback(new Error('[[error:reset-code-not-valid]]'));
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

					db.deleteObjectField('reset:uid', code);
					db.sortedSetRemove('reset:issueDate', code);

					user.auth.resetLockout(uid, callback);
				});
			});
		});
	};

	UserReset.clean = function(callback) {
		// Locate all codes that have expired, and remove them from the set/hash
		async.waterfall([
			async.apply(db.getSortedSetRangeByScore, 'reset:issueDate', 0, -1, -1, +new Date()-(1000*60*120)),
			function(tokens, next) {
				if (!tokens.length) { return next(); }

				winston.verbose('[UserReset.clean] Removing ' + tokens.length + ' reset tokens from database');
				async.parallel([
					async.apply(db.deleteObjectField, 'reset:uid', tokens),
					async.apply(db.sortedSetRemove, 'reset:issueDate', tokens)
				], next);
			}
		], callback);
	};

}(exports));
