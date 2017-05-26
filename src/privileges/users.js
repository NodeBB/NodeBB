
'use strict';

var async = require('async');

var user = require('../user');
var groups = require('../groups');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.users = {};

	privileges.users.isAdministrator = function (uid, callback) {
		if (Array.isArray(uid)) {
			groups.isMembers(uid, 'administrators', callback);
		} else {
			groups.isMember(uid, 'administrators', callback);
		}
	};

	privileges.users.isGlobalModerator = function (uid, callback) {
		if (Array.isArray(uid)) {
			groups.isMembers(uid, 'Global Moderators', callback);
		} else {
			groups.isMember(uid, 'Global Moderators', callback);
		}
	};

	privileges.users.isModerator = function (uid, cid, callback) {
		if (Array.isArray(cid)) {
			isModeratorOfCategories(cid, uid, callback);
		} else if (Array.isArray(uid)) {
			isModeratorsOfCategory(cid, uid, callback);
		} else {
			isModeratorOfCategory(cid, uid, callback);
		}
	};

	function isModeratorOfCategories(cids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return filterIsModerator(cids, uid, cids.map(function () { return false; }), callback);
		}
		var uniqueCids;
		async.waterfall([
			function (next) {
				privileges.users.isGlobalModerator(uid, next);
			},
			function (isGlobalModerator, next) {
				if (isGlobalModerator) {
					return filterIsModerator(cids, uid, cids.map(function () { return true; }), callback);
				}

				uniqueCids = cids.filter(function (cid, index, array) {
					return array.indexOf(cid) === index;
				});

				var groupNames = uniqueCids.map(function (cid) {
					return 'cid:' + cid + ':privileges:mods';	// At some point we should *probably* change this to "moderate" as well
				});

				var groupListNames = uniqueCids.map(function (cid) {
					return 'cid:' + cid + ':privileges:groups:moderate';
				});

				async.parallel({
					user: async.apply(groups.isMemberOfGroups, uid, groupNames),
					group: async.apply(groups.isMemberOfGroupsList, uid, groupListNames),
				}, next);
			},
			function (checks, next) {
				var isMembers = checks.user.map(function (isMember, idx) {
					return isMember || checks.group[idx];
				});
				var map = {};

				uniqueCids.forEach(function (cid, index) {
					map[cid] = isMembers[index];
				});

				var isModerator = cids.map(function (cid) {
					return map[cid];
				});

				filterIsModerator(cids, uid, isModerator, next);
			},
		], callback);
	}

	function isModeratorsOfCategory(cid, uids, callback) {
		async.waterfall([
			function (next) {
				async.parallel([
					async.apply(privileges.users.isGlobalModerator, uids),
					async.apply(groups.isMembers, uids, 'cid:' + cid + ':privileges:mods'),
					async.apply(groups.isMembersOfGroupList, uids, 'cid:' + cid + ':privileges:groups:moderate'),
				], next);
			},
			function (checks, next) {
				var isModerator = checks[0].map(function (isMember, idx) {
					return isMember || checks[1][idx] || checks[2][idx];
				});

				filterIsModerator(cid, uids, isModerator, next);
			},
		], callback);
	}

	function isModeratorOfCategory(cid, uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel([
					async.apply(privileges.users.isGlobalModerator, uid),
					async.apply(groups.isMember, uid, 'cid:' + cid + ':privileges:mods'),
					async.apply(groups.isMemberOfGroupList, uid, 'cid:' + cid + ':privileges:groups:moderate'),
				], next);
			},
			function (checks, next) {
				var isModerator = checks[0] || checks[1] || checks[2];
				filterIsModerator(cid, uid, isModerator, next);
			},
		], callback);
	}

	function filterIsModerator(cid, uid, isModerator, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:user.isModerator', { uid: uid, cid: cid, isModerator: isModerator }, next);
			},
			function (data, next) {
				if ((Array.isArray(uid) || Array.isArray(cid)) && !Array.isArray(data.isModerator)) {
					return callback(new Error('filter:user.isModerator - i/o mismatch'));
				}

				next(null, data.isModerator);
			},
		], callback);
	}

	privileges.users.canEdit = function (callerUid, uid, callback) {
		if (parseInt(callerUid, 10) === parseInt(uid, 10)) {
			return process.nextTick(callback, null, true);
		}
		async.waterfall([
			function (next) {
				async.parallel({
					isAdmin: function (next) {
						privileges.users.isAdministrator(callerUid, next);
					},
					isGlobalMod: function (next) {
						privileges.users.isGlobalModerator(callerUid, next);
					},
					isTargetAdmin: function (next) {
						privileges.users.isAdministrator(uid, next);
					},
				}, next);
			},
			function (results, next) {
				var canEdit = results.isAdmin || (results.isGlobalMod && !results.isTargetAdmin);

				next(null, canEdit);
			},
		], callback);
	};

	privileges.users.canBanUser = function (callerUid, uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					isAdmin: function (next) {
						privileges.users.isAdministrator(callerUid, next);
					},
					isGlobalMod: function (next) {
						privileges.users.isGlobalModerator(callerUid, next);
					},
					isTargetAdmin: function (next) {
						privileges.users.isAdministrator(uid, next);
					},
				}, next);
			},
			function (results, next) {
				results.canBan = !results.isTargetAdmin && (results.isAdmin || results.isGlobalMod);
				results.callerUid = callerUid;
				results.uid = uid;
				plugins.fireHook('filter:user.canBanUser', results, next);
			},
			function (data, next) {
				next(null, data.canBan);
			},
		], callback);
	};

	privileges.users.hasBanPrivilege = function (uid, callback) {
		async.waterfall([
			function (next) {
				user.isAdminOrGlobalMod(uid, next);
			},
			function (isAdminOrGlobalMod, next) {
				plugins.fireHook('filter:user.hasBanPrivilege', {
					uid: uid,
					isAdminOrGlobalMod: isAdminOrGlobalMod,
					canBan: isAdminOrGlobalMod,
				}, next);
			},
			function (data, next) {
				next(null, data.canBan);
			},
		], callback);
	};
};
