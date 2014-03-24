"use strict";

var	Groups = require('./groups'),
	User = require('./user'),

	async = require('async'),
	db = require('./database'),

	CategoryTools = {};

CategoryTools.exists = function(cid, callback) {
	db.isSortedSetMember('categories:cid', cid, callback);
};

CategoryTools.privileges = function(cid, uid, callback) {
	async.parallel({
		"+r": function(next) {
			var	key = 'cid:' + cid + ':privileges:+r';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					Groups.isMember(uid, key, next);
				} else {
					next(null, null);
				}
			});
		},
		"+w": function(next) {
			var	key = 'cid:' + cid + ':privileges:+w';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					Groups.isMember(uid, key, next);
				} else {
					next(null, null);
				}
			});
		},
		"g+r": function(next) {
			var	key = 'cid:' + cid + ':privileges:g+r';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					Groups.isMemberOfGroupList(uid, key, next);
				} else {
					next(null, null);
				}
			});
		},
		"g+w": function(next) {
			var	key = 'cid:' + cid + ':privileges:g+w';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					Groups.isMemberOfGroupList(uid, key, next);
				} else {
					next(null, null);
				}
			});
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
			var	key = 'cid:' + cid + ':privileges:g+r';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					Groups.isMember(groupName, key, next);
				} else {
					next(null, false);
				}
			});
		},
		"g+w": function(next) {
			var	key = 'cid:' + cid + ':privileges:g+w';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					Groups.isMember(groupName, key, next);
				} else {
					next(null, false);
				}
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
