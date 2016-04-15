
'use strict';

var async = require('async');
var nconf = require('nconf');

var db = require('./../database');
var meta = require('../meta');
var emailer = require('../emailer');
var translator = require('../../public/src/modules/translator');
var utils = require('../../public/src/utils');


module.exports = function(User) {

	User.getInvites = function(uid, callback) {
		db.getSetMembers('invitation:uid:' + uid, callback);
	};

	User.getInvitesNumber = function(uid, callback) {
		db.setCount('invitation:uid:' + uid, callback);
	};

	User.getInvitingUsers = function(callback) {
		db.getSetMembers('invitation:uids', callback);
	};

	User.getAllInvites = function(callback) {
		var uids;
		async.waterfall([
			User.getInvitingUsers,
			function(_uids, next) {
				uids = _uids;
				async.map(uids, User.getInvites, next);
			},
			function(invitations, next) {
				invitations = invitations.map(function(invites, index) {
					return {
						uid: uids[index],
						invitations: invites
					};
				});
				next(null, invitations);
			}
		], callback);
	};

	User.sendInvitationEmail = function(uid, email, callback) {
		callback = callback || function() {};

		var token = utils.generateUUID();
		var registerLink = nconf.get('url') + '/register?token=' + token + '&email=' + encodeURIComponent(email);

		var oneDay = 86400000;

		async.waterfall([
			function(next) {
				User.getUidByEmail(email, next);
			},
			function(exists, next) {
				if (exists) {
					return next(new Error('[[error:email-taken]]'));
				}
				next();
			},
			function(next) {
				async.parallel([
					function(next) {
						db.setAdd('invitation:uid:' + uid, email, next);
					},
					function(next) {
						db.setAdd('invitation:uids', uid, next);
					}
				], function(err) {
					next(err);
				});
			},
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

	User.deleteInvitation = function(invitedBy, email, callback) {
		callback = callback || function() {};
		async.waterfall([
			function getInvitedByUid(next) {
				User.getUidByUsername(invitedBy, next);
			},
			function deleteRegistries(invitedByUid, next) {
				if (!invitedByUid) {
					return next(new Error('[[error:invalid-username]]'));
				}
				async.parallel([
					function deleteFromReferenceList(next) {
						db.setRemove('invitation:uid:' + invitedByUid, email, next);
					},
					function deleteInviteKey(next) {
						db.delete('invitation:email:' + email, callback);
					}
				], function(err) {
					next(err)
				});
			}
		], callback);
	};

	User.deleteInvitationKey = function(email, callback) {
		callback = callback || function() {};
		db.delete('invitation:email:' + email, callback);
	};

};
