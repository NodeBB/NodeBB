var	Groups = require('./groups'),
	User = require('./user'),

	async = require('async'),

	CategoryTools = {};

CategoryTools.privileges = function(cid, uid, callback) {
	async.parallel({
		"+r": function(next) {
			Groups.exists('cid:' + cid + ':privileges:+r', function(err, exists) {
				if (exists) {
					Groups.isMemberByGroupName(uid, 'cid:' + cid + ':privileges:+r', next);
				} else {
					next(null, true);
				}
			});
		},
		"+w": function(next) {
			Groups.exists('cid:' + cid + ':privileges:+w', function(err, exists) {
				if (exists) {
					Groups.isMemberByGroupName(uid, 'cid:' + cid + ':privileges:+w', next);
				} else {
					next(null, true);
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
			read: privileges['+r'] || privileges.moderator || privileges.admin,
			write: privileges['+w'] || privileges.moderator || privileges.admin,
			editable: privileges.moderator || privileges.admin,
			view_deleted: privileges.moderator || privileges.admin
		});
	});
};

module.exports = CategoryTools;