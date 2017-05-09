
'use strict';

var async = require('async');
var groups = require('../groups');

var helpers = {};

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
	for (var i = 0; i < cids.length; i += 1) {
		userKeys.push('cid:' + cids[i] + ':privileges:' + privilege);
		groupKeys.push('cid:' + cids[i] + ':privileges:groups:' + privilege);
	}

	async.parallel({
		hasUserPrivilege: function (next) {
			groups.isMemberOfGroups(uid, userKeys, next);
		},
		hasGroupPrivilege: function (next) {
			groups.isMemberOfGroupsList(uid, groupKeys, next);
		},
	}, function (err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i = 0; i < cids.length; i += 1) {
			result.push(results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		callback(null, result);
	});
}

function isUserAllowedToPrivileges(privileges, uid, cid, callback) {
	if (parseInt(uid, 10) === 0) {
		return isGuestAllowedToPrivileges(privileges, cid, callback);
	}

	var userKeys = [];
	var groupKeys = [];
	for (var i = 0; i < privileges.length; i += 1) {
		userKeys.push('cid:' + cid + ':privileges:' + privileges[i]);
		groupKeys.push('cid:' + cid + ':privileges:groups:' + privileges[i]);
	}

	async.parallel({
		hasUserPrivilege: function (next) {
			groups.isMemberOfGroups(uid, userKeys, next);
		},
		hasGroupPrivilege: function (next) {
			groups.isMemberOfGroupsList(uid, groupKeys, next);
		},
	}, function (err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i = 0; i < privileges.length; i += 1) {
			result.push(results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		callback(null, result);
	});
}


helpers.isUsersAllowedTo = function (privilege, uids, cid, callback) {
	async.parallel({
		hasUserPrivilege: function (next) {
			groups.isMembers(uids, 'cid:' + cid + ':privileges:' + privilege, next);
		},
		hasGroupPrivilege: function (next) {
			groups.isMembersOfGroupList(uids, 'cid:' + cid + ':privileges:groups:' + privilege, next);
		},
	}, function (err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i = 0; i < uids.length; i += 1) {
			result.push(results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		callback(null, result);
	});
};

function isGuestAllowedToCids(privilege, cids, callback) {
	var groupKeys = [];
	for (var i = 0; i < cids.length; i += 1) {
		groupKeys.push('cid:' + cids[i] + ':privileges:groups:' + privilege);
	}

	groups.isMemberOfGroups('guests', groupKeys, callback);
}

function isGuestAllowedToPrivileges(privileges, cid, callback) {
	var groupKeys = [];
	for (var i = 0; i < privileges.length; i += 1) {
		groupKeys.push('cid:' + cid + ':privileges:groups:' + privileges[i]);
	}

	groups.isMemberOfGroups('guests', groupKeys, callback);
}

module.exports = helpers;
