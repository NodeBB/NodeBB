'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/translator'),

	db = require('../database'),
	meta = require('../meta'),
	emailer = require('../emailer');

(function(UserReset) {
	var twoHours = 7200000;

	UserReset.validate = function(code, callback) {
		async.waterfall([
			function(next) {
				db.getObjectField('reset:uid', code, next);
			},
			function(uid, next) {
				if (!uid) {
					return callback(null, false);
				}
				db.sortedSetScore('reset:issueDate', code, next);
			},
			function(issueDate, next) {
				next(null, parseInt(issueDate, 10) > Date.now() - twoHours);
			}
		], callback);
	};

	UserReset.send = function(email, callback) {
		var reset_code = utils.generateUUID();
		var uid;
		async.waterfall([
			function(next) {
				user.getUidByEmail(email, next);
			},
			function(_uid, next) {
				if (!_uid) {
					return next(new Error('[[error:invalid-email]]'));
				}

				uid = _uid;
				async.parallel([
					async.apply(db.setObjectField, 'reset:uid', reset_code, uid),
					async.apply(db.sortedSetAdd, 'reset:issueDate', Date.now(), reset_code)
				], next);
			},
			function(results, next) {
				translator.translate('[[email:password-reset-requested, ' + (meta.config.title || 'NodeBB') + ']]', meta.config.defaultLang, function(subject) {
					next(null, subject);
				});
			},
			function(subject, next) {
				var reset_link = nconf.get('url') + '/reset/' + reset_code;
				emailer.send('reset', uid, {
					site_title: (meta.config.title || 'NodeBB'),
					reset_link: reset_link,
					subject: subject,
					template: 'reset',
					uid: uid
				}, next);
			},
			function(next) {
				next(null, reset_code);
			}
		], callback);
	};

	UserReset.commit = function(code, password, callback) {
		var uid;
		async.waterfall([
			function(next) {
				UserReset.validate(code, next);
			},
			function(validated, next) {
				if (!validated) {
					return next(new Error('[[error:reset-code-not-valid]]'));
				}
				db.getObjectField('reset:uid', code, next);
			},
			function(_uid, next) {
				uid = _uid;
				if (!uid) {
					return next(new Error('[[error:reset-code-not-valid]]'));
				}

				user.hashPassword(password, next);
			},
			function(hash, next) {
				async.parallel([
					async.apply(user.setUserField, uid, 'password', hash),
					async.apply(db.deleteObjectField, 'reset:uid', code),
					async.apply(db.sortedSetRemove, 'reset:issueDate', code),
					async.apply(user.auth.resetLockout, uid)
				], next);
			}
		], callback);
	};

	UserReset.clean = function(callback) {
		async.waterfall([
			async.apply(db.getSortedSetRangeByScore, 'reset:issueDate', 0, -1, 0, Date.now() - twoHours),
			function(tokens, next) {
				if (!tokens.length) {
					return next();
				}

				winston.verbose('[UserReset.clean] Removing ' + tokens.length + ' reset tokens from database');
				async.parallel([
					async.apply(db.deleteObjectFields, 'reset:uid', tokens),
					async.apply(db.sortedSetRemove, 'reset:issueDate', tokens)
				], next);
			}
		], callback);
	};

}(exports));
