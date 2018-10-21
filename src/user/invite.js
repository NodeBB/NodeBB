
'use strict';

var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var db = require('./../database');
var meta = require('../meta');
var emailer = require('../emailer');
var translator = require('../translator');
var utils = require('../utils');

module.exports = function (User) {
	User.getInvites = function (uid, callback) {
		async.waterfall([
			function (next) {
				db.getSetMembers('invitation:uid:' + uid, next);
			},
			function (emails, next) {
				emails = emails.map(function (email) {
					return validator.escape(String(email));
				});
				next(null, emails);
			},
		], callback);
	};

	User.getInvitesNumber = function (uid, callback) {
		db.setCount('invitation:uid:' + uid, callback);
	};

	User.getInvitingUsers = function (callback) {
		db.getSetMembers('invitation:uids', callback);
	};

	User.getAllInvites = function (callback) {
		var uids;
		async.waterfall([
			User.getInvitingUsers,
			function (_uids, next) {
				uids = _uids;
				async.map(uids, User.getInvites, next);
			},
			function (invitations, next) {
				invitations = invitations.map(function (invites, index) {
					return {
						uid: uids[index],
						invitations: invites,
					};
				});
				next(null, invitations);
			},
		], callback);
	};

	User.sendInvitationEmail = function (uid, email, callback) {
		callback = callback || function () {};

		var token = utils.generateUUID();
		var registerLink = nconf.get('url') + '/register?token=' + token + '&email=' + encodeURIComponent(email);

		var expireDays = meta.config.inviteExpiration;
		var expireIn = expireDays * 86400000;

		async.waterfall([
			function (next) {
				User.getUidByEmail(email, next);
			},
			function (exists, next) {
				if (exists) {
					return next(new Error('[[error:email-taken]]'));
				}
				db.setAdd('invitation:uid:' + uid, email, next);
			},
			function (next) {
				db.setAdd('invitation:uids', uid, next);
			},
			function (next) {
				db.set('invitation:email:' + email, token, next);
			},
			function (next) {
				db.pexpireAt('invitation:email:' + email, Date.now() + expireIn, next);
			},
			function (next) {
				User.getUserField(uid, 'username', next);
			},
			function (username, next) {
				var title = meta.config.title || meta.config.browserTitle || 'NodeBB';
				translator.translate('[[email:invite, ' + title + ']]', meta.config.defaultLang, function (subject) {
					var data = {
						site_title: title,
						registerLink: registerLink,
						subject: subject,
						username: username,
						template: 'invitation',
						expireDays: expireDays,
					};

					// Append default data to this email payload
					data = Object.assign({}, emailer._defaultPayload, data);

					emailer.sendToEmail('invitation', email, meta.config.defaultLang, data, next);
				});
			},
		], callback);
	};

	User.verifyInvitation = function (query, callback) {
		if (!query.token || !query.email) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				db.get('invitation:email:' + query.email, next);
			},
			function (token, next) {
				if (!token || token !== query.token) {
					return next(new Error('[[error:invalid-token]]'));
				}

				next();
			},
		], callback);
	};

	User.deleteInvitation = function (invitedBy, email, callback) {
		callback = callback || function () {};
		async.waterfall([
			function getInvitedByUid(next) {
				User.getUidByUsername(invitedBy, next);
			},
			function deleteRegistries(invitedByUid, next) {
				if (!invitedByUid) {
					return next(new Error('[[error:invalid-username]]'));
				}
				async.parallel([
					function (next) {
						deleteFromReferenceList(invitedByUid, email, next);
					},
					function (next) {
						db.delete('invitation:email:' + email, next);
					},
				], function (err) {
					next(err);
				});
			},
		], callback);
	};

	User.deleteInvitationKey = function (email, callback) {
		callback = callback || function () {};

		async.waterfall([
			function (next) {
				User.getInvitingUsers(next);
			},
			function (uids, next) {
				async.each(uids, function (uid, next) {
					deleteFromReferenceList(uid, email, next);
				}, next);
			},
			function (next) {
				db.delete('invitation:email:' + email, next);
			},
		], callback);
	};

	function deleteFromReferenceList(uid, email, callback) {
		async.waterfall([
			function (next) {
				db.setRemove('invitation:uid:' + uid, email, next);
			},
			function (next) {
				db.setCount('invitation:uid:' + uid, next);
			},
			function (count, next) {
				if (count === 0) {
					return db.setRemove('invitation:uids', uid, next);
				}
				setImmediate(next);
			},
		], callback);
	}
};
