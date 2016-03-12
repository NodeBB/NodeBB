'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/modules/translator'),

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

	UserReset.generate = function(uid, callback) {
		var code = utils.generateUUID();
		async.parallel([
			async.apply(db.setObjectField, 'reset:uid', code, uid),
			async.apply(db.sortedSetAdd, 'reset:issueDate', Date.now(), code)
		], function(err) {
			callback(err, code);
		});
	};

	function canGenerate(uid, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetScore('reset:issueDate:uid', uid, next);
			},
			function (score, next) {
				if (score > Date.now() - 1000 * 60) {
					return next(new Error('[[error:cant-reset-password-more-than-once-a-minute]]'));
				}
				next();
			}
		], callback);
	}

	UserReset.send = function(email, callback) {
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
				canGenerate(uid, next);
			},
			function(next) {
				db.sortedSetAdd('reset:issueDate:uid', Date.now(), uid, next);
			},
			function(next) {
				UserReset.generate(uid, next);
			},
			function(code, next) {
				translator.translate('[[email:password-reset-requested, ' + (meta.config.title || 'NodeBB') + ']]', meta.config.defaultLang, function(subject) {
					next(null, subject, code);
				});
			},
			function(subject, code, next) {
				var reset_link = nconf.get('url') + '/reset/' + code;
				emailer.send('reset', uid, {
					site_title: (meta.config.title || 'NodeBB'),
					reset_link: reset_link,
					subject: subject,
					template: 'reset',
					uid: uid
				}, next);
			}
		], callback);
	};

	UserReset.commit = function(code, password, callback) {
		var uid;
		async.waterfall([
			function(next) {
				user.isPasswordValid(password, next);
			},
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
					async.apply(db.sortedSetRemove, 'reset:issueDate:uid', uid),
					async.apply(user.reset.updateExpiry, uid),
					async.apply(user.auth.resetLockout, uid)
				], next);
			}
		], callback);
	};

	UserReset.updateExpiry = function(uid, callback) {
		var oneDay = 1000 * 60 * 60 * 24;
		var expireDays = parseInt(meta.config.passwordExpiryDays || 0, 10);
		var expiry = Date.now() + (oneDay * expireDays);

		callback = callback || function() {};
		user.setUserField(uid, 'passwordExpiry', expireDays > 0 ? expiry : 0, callback);
	};

	UserReset.clean = function(callback) {
		async.waterfall([
			function(next) {
				async.parallel({
					tokens: function(next) {
						db.getSortedSetRangeByScore('reset:issueDate', 0, -1, '-inf', Date.now() - twoHours, next);
					},
					uids: function(next) {
						db.getSortedSetRangeByScore('reset:issueDate:uid', 0, -1, '-inf', Date.now() - twoHours, next);
					}
				}, next);
			},
			function(results, next) {
				if (!results.tokens.length && !results.uids.length) {
					return next();
				}

				winston.verbose('[UserReset.clean] Removing ' + results.tokens.length + ' reset tokens from database');
				async.parallel([
					async.apply(db.deleteObjectFields, 'reset:uid', results.tokens),
					async.apply(db.sortedSetRemove, 'reset:issueDate', results.tokens),
					async.apply(db.sortedSetRemove, 'reset:issueDate:uid', results.uids)
				], next);
			}
		], callback);
	};

}(exports));
