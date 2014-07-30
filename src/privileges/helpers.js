
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

helpers.allowedTo = function(privilege, uid, cids, callback) {

	if (!Array.isArray(cids)) {
		cids = [cids];
	}

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
			async.map(groupKeys, function(groupKey, next) {
				groups.isMemberOfGroupList(uid, groupKey, next);
			}, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i=0; i<cids.length; ++i) {
			result.push((!results.userPrivilegeExists[i] && !results.groupPrivilegeExists[i]) || results.hasUserPrivilege[i] || results.hasGroupPrivilege[i]);
		}

		if (result.length === 1) {
			result = result[0];
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
		hasGroupPrivilege: function(next) {
			groups.isMemberOfGroups('guests', groupKeys, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var result = [];
		for (var i = 0; i<cids.length; ++i) {
			var groupPriv = privilege !== 'find' && privilege !== 'read' ? results.hasGroupPrivilege[i] === true : results.hasGroupPrivilege[i] !== false;
			result.push(!results.userPrivilegeExists[i] && groupPriv);
		}

		if (result.length === 1) {
			result = result[0];
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