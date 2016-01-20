
'use strict';

var async = require('async');
var nconf = require('nconf');

var user = require('../user');
var utils = require('../../public/src/utils');
var translator = require('../../public/src/modules/translator');
var plugins = require('../plugins');
var db = require('../database');
var meta = require('../meta');
var emailer = require('../emailer');

(function(UserEmail) {

	UserEmail.exists = function(email, callback) {
		user.getUidByEmail(email.toLowerCase(), function(err, exists) {
			callback(err, !!exists);
		});
	};

	UserEmail.available = function(email, callback) {
		db.isSortedSetMember('email:uid', email.toLowerCase(), function(err, exists) {
			callback(err, !exists);
		});
	};

	UserEmail.sendValidationEmail = function(uid, email, callback) {
		callback = callback || function() {};
		var confirm_code = utils.generateUUID(),
			confirm_link = nconf.get('url') + '/confirm/' + confirm_code;

		var emailInterval = meta.config.hasOwnProperty('emailConfirmInterval') ? parseInt(meta.config.emailConfirmInterval, 10) : 10;

		async.waterfall([
			function(next) {
				db.get('uid:' + uid + ':confirm:email:sent', next);
			},
			function(sent, next) {
				if (sent) {
					return next(new Error('[[error:confirm-email-already-sent, ' + emailInterval + ']]'));
				}
				db.set('uid:' + uid + ':confirm:email:sent', 1, next);
			},
			function(next) {
				db.pexpireAt('uid:' + uid + ':confirm:email:sent', Date.now() + (emailInterval * 60 * 1000), next);
			},
			function(next) {
				plugins.fireHook('filter:user.verify.code', confirm_code, next);
			},
			function(_confirm_code, next) {
				confirm_code = _confirm_code;
				db.setObject('confirm:' + confirm_code, {
					email: email.toLowerCase(),
					uid: uid
				}, next);
			},
			function(next) {
				db.expireAt('confirm:' + confirm_code, Math.floor(Date.now() / 1000 + 60 * 60 * 24), next);
			},
			function(next) {
				user.getUserField(uid, 'username', next);
			},
			function(username, next) {
				var title = meta.config.title || meta.config.browserTitle || 'NodeBB';
				translator.translate('[[email:welcome-to, ' + title + ']]', meta.config.defaultLang, function(subject) {
					var data = {
						site_title: title,
						username: username,
						confirm_link: confirm_link,
						confirm_code: confirm_code,

						subject: subject,
						template: 'welcome',
						uid: uid
					};

					if (plugins.hasListeners('action:user.verify')) {
						plugins.fireHook('action:user.verify', {uid: uid, data: data});
						next();
					} else {
						emailer.send('welcome', uid, data, next);
					}
				});
			}
		], callback);
	};

	UserEmail.confirm = function(code, callback) {
		db.getObject('confirm:' + code, function(err, confirmObj) {
			if (err) {
				return callback(new Error('[[error:parse-error]]'));
			}

			if (confirmObj && confirmObj.uid && confirmObj.email) {
				async.series([
					async.apply(user.setUserField, confirmObj.uid, 'email:confirmed', 1),
					async.apply(db.delete, 'confirm:' + code),
					function(next) {
						db.sortedSetRemove('users:notvalidated', confirmObj.uid, next);
					}
				], function(err) {
					callback(err ? new Error('[[error:email-confirm-failed]]') : null);
				});
			} else {
				callback(new Error('[[error:invalid-data]]'));
			}
		});
	};

}(exports));
