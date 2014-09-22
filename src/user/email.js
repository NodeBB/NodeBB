
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/translator'),
	plugins = require('../plugins'),
	db = require('../database'),
	meta = require('../meta'),
	emailer = require('../emailer');

(function(UserEmail) {

	UserEmail.exists = function(email, callback) {
		user.getUidByEmail(email.toLowerCase(), function(err, exists) {
			callback(err, !!exists);
		});
	};

	UserEmail.available = function(email, callback) {
		db.isObjectField('email:uid', email.toLowerCase(), function(err, exists) {
			callback(err, !exists);
		});
	};

	UserEmail.verify = function(uid, email) {
		var confirm_code = utils.generateUUID(),
			confirm_link = nconf.get('url') + '/confirm/' + confirm_code;

		plugins.fireHook('filter:user.verify.code', confirm_code, function(err, confirm_code) {
			async.series([
				function(next) {
					db.setObject('confirm:' + confirm_code, {
						email: email.toLowerCase(),
						uid: uid
					}, next);
				},
				function(next) {
					db.expireAt('confirm:' + confirm_code, Math.floor(Date.now() / 1000 + 60 * 60 * 2), next);
				}
			], function(err) {

				user.getUserField(uid, 'username', function(err, username) {
					if (err) {
						return winston.error(err.stack);
					}

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
							plugins.fireHook('action:user.verify', uid, data);
						} else if (plugins.hasListeners('action:email.send')) {
							emailer.send('welcome', uid, data);
						}
					});
				});
			});
		});
	};

	UserEmail.confirm = function(code, callback) {
		db.getObject('confirm:' + code, function(err, confirmObj) {
			if (err) {
				return callback({
					status:'error'
				});
			}

			if (confirmObj && confirmObj.uid && confirmObj.email) {
				user.setUserField(confirmObj.uid, 'email:confirmed', 1, function() {
					callback({
						status: 'ok'
					});
				});
			} else {
				callback({
					status: 'not_ok'
				});
			}
		});
	};

}(exports));
