
'use strict';

var async = require('async'),

	meta = require('../meta'),
	user = require('../user'),
	groups = require('../groups'),
	categories = require('../categories');

var helpers = {};

helpers.allowedTo = function(privilege, uid, cid, callback) {
	categories.getCategoryField(cid, 'disabled', function(err, disabled) {
		if (err) {
			return callback(err);
		}

		if (parseInt(disabled, 10) === 1) {
			return callback(null, false);
		}

		async.parallel({
			hasUserPrivilege: function(next) {
				hasPrivilege(groups.isMember, 'cid:' + cid + ':privileges:' + privilege, uid, next);
			},
			hasGroupPrivilege: function(next) {
				hasPrivilege(groups.isMemberOfGroupList, 'cid:' + cid + ':privileges:groups:' + privilege, uid, next);
			},
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			callback(null,  results.hasUserPrivilege && results.hasGroupPrivilege);
		});
	});
};

function hasPrivilege(method, group, uid, callback) {
	groups.exists(group, function(err, exists) {
		if (err) {
			return callback(err);
		}

		if (!exists) {
			return callback(null, true);
		}

		method(group, uid, callback);
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