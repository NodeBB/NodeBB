
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),
	db = require('./../database'),

	meta = require('../meta'),
	emailer = require('../emailer'),

	plugins = require('../plugins'),
	translator = require('../../public/src/modules/translator'),
	utils = require('../../public/src/utils');


module.exports = function(User) {

	User.sendInvitationEmail = function(uid, email, callback) {
		callback = callback || function() {};
		var token = utils.generateUUID();
		var registerLink = nconf.get('url') + '/register?token=' + token + '&email=' + email;

		var oneDay = 86400000;
		async.waterfall([
			function(next) {
				db.set('invitation:email:' + email, token, next);
			},
			function(next) {
				db.pexpireAt('invitation:email:' + email, Date.now() + oneDay, next);
			},
			function(next) {
				User.getUserField(uid, 'username', next);
			},
			function(username, next) {
				var title = meta.config.title || meta.config.browserTitle || 'NodeBB';
				translator.translate('[[email:invite, ' + title + ']]', meta.config.defaultLang, function(subject) {
					var data = {
						site_title: title,
						registerLink: registerLink,
						subject: subject,
						username: username,
						template: 'invitation'
					};

					emailer.sendToEmail('invitation', email, meta.config.defaultLang, data, next);
				});
			}
		], callback);
	};

	User.verifyInvitation = function(query, callback) {
		if (!query.token || !query.email) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function(next) {
				db.get('invitation:email:' + query.email, next);
			},
			function(token, next) {
				if (!token || token !== query.token) {
					return next(new Error('[[error:invalid-token]]'));
				}

				next();
			}
		], callback);
	};

	User.deleteInvitation = function(email, callback) {
		callback = callback || function() {};
		db.delete('invitation:email:' + email, callback);
	};

};