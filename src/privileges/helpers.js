
'use strict';

var async = require('async'),
	db = require('../database'),
	meta = require('../meta'),
	user = require('../user'),
	groups = require('../groups'),
	categories = require('../categories');

var helpers = {};

helpers.some = function(tasks, callback) {
	async.some(tasks, function(task, next) {
		task(function(err, result) {
			next(!err && result);
		});
	}, function(result) {
		callback(null, result);
	});
};

helpers.isUserAllowedTo = function(privilege, uid, cids, callback) {
	if (parseInt(uid, 10) === 0) {
		return isGuestAllowedTo(privilege, cids, callback);
	}

	var userKeys = [], groupKeys = [];
	for (var i=0; i<cids.length; ++i) {
		userKeys.push('cid:' + cids[i] + ':privileges:' + privilege);
		groupKeys.push('cid:' + cids[i] + ':privileges:groups:' + privilege);
	}

	async.parallel({
		userPrivilegeExists: function(next) {
			groups.exists(userKeys, next);
		},
		groupPrivilegeExists: function(next) {
			groups.exists(groupKeys, next);
		},
		hasUserPrivilege: function(next) {
			groups.isMemberOfGroups(uid, userKeys, next);
		},
		hasGroupPrivilege: function(next) {
			groups.isMemberOfGroupsList(uid, groupKeys, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i=0; i<cids.length; ++i) {
			result.push((!results.userPrivilegeExists[i] && !results.groupPrivilegeExists[i]) || results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		callback(null, result);
	});
};

helpers.isUsersAllowedTo = function(privilege, uids, cid, callback) {
	async.parallel({
		userPrivilegeExists: function(next) {
			groups.exists('cid:' + cid + ':privileges:' + privilege, next);
		},
		groupPrivilegeExists: function(next) {
			groups.exists('cid:' + cid + ':privileges:groups:' + privilege, next);
		},
		hasUserPrivilege: function(next) {
			groups.isMembers(uids, 'cid:' + cid + ':privileges:' + privilege, next);
		},
		hasGroupPrivilege: function(next) {
			groups.isMembersOfGroupList(uids, 'cid:' + cid + ':privileges:groups:' + privilege, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];

		for(var i=0; i<uids.length; ++i) {
			result.push((!results.userPrivilegeExists && !results.groupPrivilegeExists) || results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		callback(null, result);
	});
};

function isGuestAllowedTo(privilege, cids, callback) {
	var userKeys = [], groupKeys = [];
	for (var i=0; i<cids.length; ++i) {
		userKeys.push('cid:' + cids[i] + ':privileges:' + privilege);
		groupKeys.push('cid:' + cids[i] + ':privileges:groups:' + privilege);
	}

	async.parallel({
		userPrivilegeExists: function(next) {
			groups.exists(userKeys, next);
		},
		groupPrivilegeExists: function(next) {
			groups.exists(groupKeys, next);
		},
		hasGroupPrivilege: function(next) {
			groups.isMemberOfGroups('guests', groupKeys, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i = 0; i<cids.length; ++i) {
			var groupPriv = (privilege === 'find' || privilege === 'read') ?
				(!results.groupPrivilegeExists[i] || results.hasGroupPrivilege[i] !== false) :
				(results.groupPrivilegeExists[i] && results.hasGroupPrivilege[i] === true);

			result.push(!results.userPrivilegeExists[i] && groupPriv);
		}

		callback(null, result);
	});
}

helpers.hasEnoughReputationFor = function(privilege, uid, callback) {
	if (parseInt(meta.config['privileges:disabled'], 10)) {
		return callback(null, false);
	}

	user.getUserField(uid, 'reputation', function(err, reputation) {
		if (err) {
			return callback(null, false);
		}
		callback(null, parseInt(reputation, 10) >= parseInt(meta.config[privilege], 10));
	});
};

module.exports = helpers;