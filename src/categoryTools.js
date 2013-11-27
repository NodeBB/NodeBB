var	Groups = require('./groups'),
	User = require('./user'),

	async = require('async'),

	CategoryTools = {};

CategoryTools.privileges = function(cid, uid, callback) {
	async.parallel({
		"+r": function(next) {
			Groups.isMemberByGroupName(uid, 'cid:' + cid + ':privileges:+r', next);
		},
		"+w": function(next) {
			Groups.isMemberByGroupName(uid, 'cid:' + cid + ':privileges:+w', next);
		},
		moderator: function(next) {
			User.isModerator(uid, cid, next);
		},
		admin: function(next) {
			User.isAdministrator(uid, next);
		}
	}, function(err, privileges) {
		callback(err, !privileges ? null : {
			read: privileges['+r'] || privileges.moderator || privileges.admin,
			write: privileges['+w'] || privileges.moderator || privileges.admin,
			editable: privileges.moderator || privileges.admin,
			view_deleted: privileges.moderator || privileges.admin
		});
	});
};

module.exports = CategoryTools;