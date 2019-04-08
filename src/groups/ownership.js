'use strict';

var async = require('async');
var db = require('../database');
var plugins = require('../plugins');

module.exports = function (Groups) {
	Groups.ownership = {};

	Groups.ownership.isOwner = function (uid, groupName, callback) {
		if (!(parseInt(uid, 10) > 0)) {
			return setImmediate(callback, null, false);
		}
		db.isSetMember('group:' + groupName + ':owners', uid, callback);
	};

	Groups.ownership.isOwners = function (uids, groupName, callback) {
		if (!Array.isArray(uids)) {
			return setImmediate(callback, null, []);
		}

		db.isSetMembers('group:' + groupName + ':owners', uids, callback);
	};

	Groups.ownership.grant = function (toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!
		async.waterfall([
			function (next) {
				db.setAdd('group:' + groupName + ':owners', toUid, next);
			},
			function (next) {
				plugins.fireHook('action:group.grantOwnership', { uid: toUid, groupName: groupName });
				next();
			},
		], callback);
	};

	Groups.ownership.rescind = function (toUid, groupName, callback) {
		// Note: No ownership checking is done here on purpose!

		// If the owners set only contains one member, error out!
		async.waterfall([
			function (next) {
				db.setCount('group:' + groupName + ':owners', next);
			},
			function (numOwners, next) {
				if (numOwners <= 1) {
					return next(new Error('[[error:group-needs-owner]]'));
				}
				db.setRemove('group:' + groupName + ':owners', toUid, next);
			},
			function (next) {
				plugins.fireHook('action:group.rescindOwnership', { uid: toUid, groupName: groupName });
				next();
			},
		], callback);
	};
};
