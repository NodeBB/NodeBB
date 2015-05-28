'use strict';

var	db = require('../database');

module.exports = function(Groups) {

	Groups.ownership = {};

	Groups.ownership.isOwner = function(uid, groupName, callback) {
		if (!uid) {
			return callback(null, false);
		}
		db.isSetMember('group:' + groupName + ':owners', uid, callback);
	};

	Groups.ownership.grant = function(toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!
		db.setAdd('group:' + groupName + ':owners', toUid, callback);
	};

	Groups.ownership.rescind = function(toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!

		// If the owners set only contains one member, error out!
		db.setCount('group:' + groupName + ':owners', function(err, numOwners) {
			if (err) {
				return callback(err);
			}
			if (numOwners <= 1) {
				return callback(new Error('[[error:group-needs-owner]]'));
			}

			db.setRemove('group:' + groupName + ':owners', toUid, callback);
		});
	};
};
