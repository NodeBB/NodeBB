
'use strict';

var async = require('async');

var groups = require('../groups');
var plugins = require('../plugins');

module.exports = function(privileges) {

	privileges.users = {};

	privileges.users.isAdministrator = function(uid, callback) {
		if (Array.isArray(uid)) {
			groups.isMembers(uid, 'administrators', callback);
		} else {
			groups.isMember(uid, 'administrators', callback);
		}
	};

	privileges.users.isGlobalModerator = function(uid, callback) {
		if (Array.isArray(uid)) {
			groups.isMembers(uid, 'Global Moderators', callback);
		} else {
			groups.isMember(uid, 'Global Moderators', callback);
		}
	};

	privileges.users.isModerator = function(uid, cid, callback) {
		if (Array.isArray(cid)) {
			isModeratorOfCategories(cid, uid, callback);
		} else {
			if (Array.isArray(uid)) {
				isModeratorsOfCategory(cid, uid, callback);
			} else {
				isModeratorOfCategory(cid, uid, callback);
			}
		}
	};

	function isModeratorOfCategories(cids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return filterIsModerator(cids, uid, cids.map(function() {return false;}), callback);
		}

		privileges.users.isGlobalModerator(uid, function(err, isGlobalModerator) {
			if (err) {
				return callback(err);
			}
			if (isGlobalModerator) {
				return filterIsModerator(cids, uid, cids.map(function() {return true;}), callback);
			}


			var uniqueCids = cids.filter(function(cid, index, array) {
				return array.indexOf(cid) === index;
			});

			var groupNames = uniqueCids.map(function(cid) {
				return 'cid:' + cid + ':privileges:mods';	// At some point we should *probably* change this to "moderate" as well
			});

			var groupListNames = uniqueCids.map(function(cid) {
				return 'cid:' + cid + ':privileges:groups:moderate';
			});

			async.parallel({
				user: async.apply(groups.isMemberOfGroups, uid, groupNames),
				group: async.apply(groups.isMemberOfGroupsList, uid, groupListNames)
			}, function(err, checks) {
				if (err) {
					return callback(err);
				}

				var isMembers = checks.user.map(function(isMember, idx) {
						return isMember || checks.group[idx];
					}),
					map = {};

				uniqueCids.forEach(function(cid, index) {
					map[cid] = isMembers[index];
				});

				var isModerator = cids.map(function(cid) {
					return map[cid];
				});

				filterIsModerator(cids, uid, isModerator, callback);
			});
		});
	}

	function isModeratorsOfCategory(cid, uids, callback) {
		async.parallel([
			async.apply(privileges.users.isGlobalModerator, uids),
			async.apply(groups.isMembers, uids, 'cid:' + cid + ':privileges:mods'),
			async.apply(groups.isMembersOfGroupList, uids, 'cid:' + cid + ':privileges:groups:moderate')
		], function(err, checks) {
			if (err) {
				return callback(err);
			}

			var isModerator = checks[0].map(function(isMember, idx) {
				return isMember || checks[1][idx] || checks[2][idx];
			});

			filterIsModerator(cid, uids, isModerator, callback);
		});
	}

	function isModeratorOfCategory(cid, uid, callback) {
		async.parallel([
			async.apply(privileges.users.isGlobalModerator, uid),
			async.apply(groups.isMember, uid, 'cid:' + cid + ':privileges:mods'),
			async.apply(groups.isMemberOfGroupList, uid, 'cid:' + cid + ':privileges:groups:moderate')
		], function(err, checks) {
			if (err) {
				return callback(err);
			}

			var isModerator = checks[0] || checks[1] || checks[2];
			filterIsModerator(cid, uid, isModerator, callback);
		});
	}

	function filterIsModerator(cid, uid, isModerator, callback) {
		plugins.fireHook('filter:user.isModerator', {uid: uid, cid: cid, isModerator: isModerator}, function(err, data) {
			if (err) {
				return callback(err);
			}
			if (Array.isArray(uid) && !Array.isArray(data.isModerator) || Array.isArray(cid) && !Array.isArray(data.isModerator)) {
				return callback(new Error('filter:user.isModerator - i/o mismatch'));
			}

			callback(null, data.isModerator);
		});
	}

};
