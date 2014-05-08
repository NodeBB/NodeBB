"use strict";

var	Groups = require('./groups'),
	User = require('./user'),
	categories = require('./categories'),

	async = require('async'),
	db = require('./database');

var internals = {
	isMember: function(key, candidate, next){
		Groups.exists(key, function(err, exists) {
			if (exists) {
				Groups.isMember(candidate, key, next);
			} else {
				next(null, null);
			}
		});
	},

	isMemberOfGroupList: function(key, candidate, next){
		Groups.exists(key, function(err, exists) {
			if (exists) {
				Groups.isMemberOfGroupList(candidate, key, next);
			} else {
				next(null, null);
			}
		});
	}
};

var CategoryTools = {};

CategoryTools.exists = function(cid, callback) {
	db.isSortedSetMember('categories:cid', cid, callback);
};

CategoryTools.privileges = function(cid, uid, callback) {
	async.parallel({
		disabled: function(next) {
			categories.getCategoryField(cid, 'disabled', next);
		},
		read: function(next) {
			internals.isMember('cid:' + cid + ':privileges:read', uid, next);
		},
		"topics:create": function(next) {
			internals.isMember('cid:' + cid + ':privileges:topics:create', uid, next);
		},
		"topics:reply": function(next) {
			internals.isMember('cid:' + cid + ':privileges:topics:reply', uid, next);
		},
		// "+r": function(next) {
		// 	internals.isMember('cid:' + cid + ':privileges:+r', uid, next);
		// },
		// "+w": function(next) {
		// 	internals.isMember('cid:' + cid + ':privileges:+w', uid, next);
		// },
		// "g+r": function(next) {
		// 	internals.isMemberOfGroupList('cid:' + cid + ':privileges:g+r', uid, next);
		// },
		// "g+w": function(next) {
		// 	internals.isMemberOfGroupList('cid:' + cid + ':privileges:g+w', uid, next);
		// },
		moderator: function(next) {
			User.isModerator(uid, cid, next);
		},
		admin: function(next) {
			User.isAdministrator(uid, next);
		}
	}, function(err, privileges) {
		callback(err, !privileges ? null : {
			"+r": privileges['+r'],
			"+w": privileges['+w'],
			"g+r": privileges['g+r'],
			"g+w": privileges['g+w'],
			read: (
				(
					parseInt(privileges.disabled, 10) !== 1 &&
					(privileges['+r'] || privileges['+r'] === null) &&
					(privileges['g+r'] || privileges['g+r'] === null)
				) ||
				privileges.moderator ||
				privileges.admin
			),
			// write: (
			// 	(
			// 		parseInt(privileges.disabled, 10) !== 1 &&
			// 		(privileges['+w'] || privileges['+w'] === null) &&
			// 		(privileges['g+w'] || privileges['g+w'] === null)
			// 	) ||
			// 	privileges.moderator ||
			// 	privileges.admin
			// ),
			editable: privileges.moderator || privileges.admin,
			view_deleted: privileges.moderator || privileges.admin,
			moderator: privileges.moderator,
			admin: privileges.admin
		});
	});
};

CategoryTools.groupPrivileges = function(cid, groupName, callback) {
	async.parallel({
		"groups:read":function(next) {
			internals.isMember('cid:' + cid + ':privileges:groups:read', groupName, function(err, isMember){
				next(err, !!isMember);
			});
		},
		"groups:topics:create":function(next) {
			internals.isMember('cid:' + cid + ':privileges:groups:topics:create', groupName, function(err, isMember){
				next(err, !!isMember);
			});
		},
		"groups:topics:reply":function(next) {
			internals.isMember('cid:' + cid + ':privileges:groups:topics:reply', groupName, function(err, isMember){
				next(err, !!isMember);
			});
		}
	}, function(err, privileges) {
		callback(err, privileges || null);
	});
};

module.exports = CategoryTools;
