"use strict";

var	Groups = require('./groups'),
	User = require('./user'),

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
		"+r": function(next) {
			internals.isMember('cid:' + cid + ':privileges:+r', uid, next);
		},
		"+w": function(next) {
			internals.isMember('cid:' + cid + ':privileges:+w', uid, next);
		},
		"g+r": function(next) {
			internals.isMemberOfGroupList('cid:' + cid + ':privileges:g+r', uid, next);
		},
		"g+w": function(next) {
			internals.isMemberOfGroupList('cid:' + cid + ':privileges:g+w', uid, next);
		},
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
					(privileges['+r'] || privileges['+r'] === null) &&
					(privileges['g+r'] || privileges['g+r'] === null)
				) ||
				privileges.moderator ||
				privileges.admin
			),
			write: (
				(
					(privileges['+w'] || privileges['+w'] === null) &&
					(privileges['g+w'] || privileges['g+w'] === null)
				) ||
				privileges.moderator ||
				privileges.admin
			),
			editable: privileges.moderator || privileges.admin,
			view_deleted: privileges.moderator || privileges.admin,
			moderator: privileges.moderator,
			admin: privileges.admin
		});
	});
};

CategoryTools.groupPrivileges = function(cid, groupName, callback) {
	async.parallel({
		"g+r": function(next) {
			internals.isMember('cid:' + cid + ':privileges:g+r', groupName, function(err, isMember){
				next(err, !!isMember);
			});
		},
		"g+w": function(next) {
			internals.isMember('cid:' + cid + ':privileges:g+w', groupName, function(err, isMember){
				next(err, !!isMember);
			});
		}
	}, function(err, privileges) {
		callback(err, !privileges ? null : {
			"g+r": privileges['g+r'],
			"g+w": privileges['g+w']
		});
	});
};

module.exports = CategoryTools;
