
'use strict';

var async = require('async');
var groups = require('../groups');

var helpers = module.exports;

helpers.some = function (tasks, callback) {
	async.some(tasks, function (task, next) {
		task(next);
	}, callback);
};

helpers.isUserAllowedTo = function (privilege, uid, cid, callback) {
	if (Array.isArray(privilege) && !Array.isArray(cid)) {
		isUserAllowedToPrivileges(privilege, uid, cid, callback);
	} else if (Array.isArray(cid) && !Array.isArray(privilege)) {
		isUserAllowedToCids(privilege, uid, cid, callback);
	} else {
		return callback(new Error('[[error:invalid-data]]'));
	}
};

function isUserAllowedToCids(privilege, uid, cids, callback) {
	if (parseInt(uid, 10) === 0) {
		return isGuestAllowedToCids(privilege, cids, callback);
	}

	var userKeys = [];
	var groupKeys = [];
	cids.forEach(function (cid) {
		userKeys.push('cid:' + cid + ':privileges:' + privilege);
		groupKeys.push('cid:' + cid + ':privileges:groups:' + privilege);
	});

	checkIfAllowed(uid, userKeys, groupKeys, callback);
}

function isUserAllowedToPrivileges(privileges, uid, cid, callback) {
	if (parseInt(uid, 10) === 0) {
		return isGuestAllowedToPrivileges(privileges, cid, callback);
	}

	var userKeys = [];
	var groupKeys = [];
	privileges.forEach(function (privilege) {
		userKeys.push('cid:' + cid + ':privileges:' + privilege);
		groupKeys.push('cid:' + cid + ':privileges:groups:' + privilege);
	});

	checkIfAllowed(uid, userKeys, groupKeys, callback);
}

function checkIfAllowed(uid, userKeys, groupKeys, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				hasUserPrivilege: function (next) {
					groups.isMemberOfGroups(uid, userKeys, next);
				},
				hasGroupPrivilege: function (next) {
					groups.isMemberOfGroupsList(uid, groupKeys, next);
				},
			}, next);
		},
		function (results, next) {
			var result = userKeys.map(function (key, index) {
				return results.hasUserPrivilege[index] || results.hasGroupPrivilege[index];
			});

			next(null, result);
		},
	], callback);
}

helpers.isUsersAllowedTo = function (privilege, uids, cid, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				hasUserPrivilege: function (next) {
					groups.isMembers(uids, 'cid:' + cid + ':privileges:' + privilege, next);
				},
				hasGroupPrivilege: function (next) {
					groups.isMembersOfGroupList(uids, 'cid:' + cid + ':privileges:groups:' + privilege, next);
				},
			}, next);
		},
		function (results, next) {
			var result = uids.map(function (uid, index) {
				return results.hasUserPrivilege[index] || results.hasGroupPrivilege[index];
			});

			next(null, result);
		},
	], callback);
};

function isGuestAllowedToCids(privilege, cids, callback) {
	var groupKeys = cids.map(function (cid) {
		return 'cid:' + cid + ':privileges:groups:' + privilege;
	});

	groups.isMemberOfGroups('guests', groupKeys, callback);
}

function isGuestAllowedToPrivileges(privileges, cid, callback) {
	var groupKeys = privileges.map(function (privilege) {
		return 'cid:' + cid + ':privileges:groups:' + privilege;
	});

	groups.isMemberOfGroups('guests', groupKeys, callback);
}
