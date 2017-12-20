
'use strict';

var async = require('async');
var _ = require('lodash');

var user = require('../user');
var groups = require('../groups');
var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.global = {};

	privileges.global.privilegeLabels = [
		{ name: 'Chat' },
	];

	privileges.global.userPrivilegeList = [
		'chat',
	];

	privileges.global.groupPrivilegeList = privileges.global.userPrivilegeList.map(function (privilege) {
		return 'groups:' + privilege;
	});

	privileges.global.list = function (callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					labels: function (next) {
						async.parallel({
							users: async.apply(plugins.fireHook, 'filter:privileges.global.list_human', privileges.global.privilegeLabels.slice()),
							groups: async.apply(plugins.fireHook, 'filter:privileges.global.groups.list_human', privileges.global.privilegeLabels.slice()),
						}, next);
					},
					users: function (next) {
						helpers.getUserPrivileges(0, 'filter:privileges.global.list', privileges.global.userPrivilegeList, next);
					},
					groups: function (next) {
						helpers.getGroupPrivileges(0, 'filter:privileges.global.groups.list', privileges.global.groupPrivilegeList, next);
					},
				}, next);
			},
			function (payload, next) {
				// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
				payload.columnCount = payload.labels.users.length + 2;
				next(null, payload);
			},
		], callback);
	};

	privileges.global.can = function (privilege, uid, callback) {
		helpers.some([
			function (next) {
				helpers.isUserAllowedTo(privilege, uid, [0], function (err, results) {
					next(err, Array.isArray(results) && results.length ? results[0] : false);
				});
			},
			function (next) {
				user.isGlobalModerator(uid, next);
			},
			function (next) {
				user.isAdministrator(uid, next);
			},
		], callback);
	};


};
