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
		"disabled": function(next) {
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
		"groups:read": function(next) {
			internals.isMemberOfGroupList('cid:' + cid + ':privileges:groups:read', uid, next);
		},
		"groups:topics:create": function(next) {
			internals.isMemberOfGroupList('cid:' + cid + ':privileges:groups:topics:create', uid, next);
		},
		"groups:topics:reply": function(next) {
			internals.isMemberOfGroupList('cid:' + cid + ':privileges:groups:topics:reply', uid, next);
		},
		mods: function(next) {
			User.isModerator(uid, cid, next);
		},
		admin: function(next) {
			User.isAdministrator(uid, next);
		}
	}, function(err, privileges) {
		if (privileges) {
			privileges.meta = {
				read: (
					(
						parseInt(privileges.disabled, 10) !== 1 &&
						(
							(privileges['read'] === null && privileges['groups:read'] === null) ||
							privileges['read'] || privileges['groups:read']
						)
					) ||
					privileges.mods ||
					privileges.admin
				),
				"topics:create": (
					(
						parseInt(privileges.disabled, 10) !== 1 &&
						(
							(privileges['topics:create'] === null && privileges['groups:topics:create'] === null) ||
							privileges['topics:create'] || privileges['groups:topics:create']
						)
					) ||
					privileges.mods ||
					privileges.admin
				),
				"topics:reply": (
					(
						parseInt(privileges.disabled, 10) !== 1 &&
						(
							(privileges['topics:reply'] === null && privileges['groups:topics:reply'] === null) ||
							privileges['topics:reply'] || privileges['groups:topics:reply']
						)
					) ||
					privileges.mods ||
					privileges.admin
				),
				editable: privileges.mods || privileges.admin,
				view_deleted: privileges.mods || privileges.admin
			};
		}

		// console.log(privileges, cid, uid);
		callback(err, privileges || null);
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
