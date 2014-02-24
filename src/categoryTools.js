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
					async.parallel({
						isMember: function(next) {
							Groups.isMemberByGroupName(uid, key, next);
						},
						isEmpty: function(next) {
							Groups.isEmptyByGroupName(key, next);
						}
					}, next);
				} else {
					next(null, {
						isMember: false,
						isEmpty: true
					});
				}
			});
		},
		"+w": function(next) {
			var	key = 'cid:' + cid + ':privileges:+w';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					async.parallel({
						isMember: function(next) {
							Groups.isMemberByGroupName(uid, key, next);
						},
						isEmpty: function(next) {
							Groups.isEmptyByGroupName(key, next);
						}
					}, next);
				} else {
					next(null, {
						isMember: false,
						isEmpty: true
					});
				}
			});
		},
		"g+r": function(next) {
			var	key = 'cid:' + cid + ':privileges:g+r';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					async.parallel({
						isMember: function(next) {
							Groups.isMemberOfGroupAny(uid, key, next);
						},
						isEmpty: function(next) {
							Groups.isEmptyByGroupName(key, next);
						}
					}, next);
				} else {
					next(null, {
						isMember: false,
						isEmpty: true
					});
				}
			});
		},
		"g+w": function(next) {
			var	key = 'cid:' + cid + ':privileges:g+w';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					async.parallel({
						isMember: function(next) {
							Groups.isMemberOfGroupAny(uid, key, next);
						},
						isEmpty: function(next) {
							Groups.isEmptyByGroupName(key, next);
						}
					}, next);
				} else {
					next(null, {
						isMember: false,
						isEmpty: true
					});
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
			"+r": privileges['+r'].isMember,
			"+w": privileges['+w'].isMember,
			"g+r": privileges['g+r'].isMember,
			"g+w": privileges['g+w'].isMember,
			read: (
				(
					(privileges['+r'].isMember || privileges['+r'].isEmpty) &&
					(privileges['g+r'].isMember || privileges['g+r'].isEmpty)
				) ||
				privileges.moderator ||
				privileges.admin
			),
			write: (
				(
					(privileges['+w'].isMember || privileges['+w'].isEmpty) &&
					(privileges['g+w'].isMember || privileges['g+w'].isEmpty)
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

CategoryTools.groupPrivileges = function(cid, gid, callback) {
	async.parallel({
		"g+r": function(next) {
			var	key = 'cid:' + cid + ':privileges:g+r';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					async.parallel({
						isMember: function(next) {
							Groups.isMemberByGroupName(gid, key, next);
						}
					}, next);
				} else {
					next(null, {
						isMember: false,
						isEmpty: true
					});
				}
			});
		},
		"g+w": function(next) {
			var	key = 'cid:' + cid + ':privileges:g+w';
			Groups.exists(key, function(err, exists) {
				if (exists) {
					async.parallel({
						isMember: function(next) {
							Groups.isMemberByGroupName(gid, key, next);
						}
					}, next);
				} else {
					next(null, {
						isMember: false,
						isEmpty: true
					});
				}
			});
		}
	}, function(err, privileges) {
		callback(err, !privileges ? null : {
			"g+r": privileges['g+r'].isMember,
			"g+w": privileges['g+w'].isMember
		});
	});
};

module.exports = CategoryTools;
