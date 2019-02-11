
'use strict';

var async = require('async');
const user = require('../user');

var helpers = require('./helpers');
var plugins = require('../plugins');

module.exports = function (privileges) {
	privileges.admin = {};

	privileges.admin.privilegeLabels = [
		{ name: '[[admin/manage/privileges:acp.general]]' },
		{ name: '[[admin/manage/privileges:acp.manage]]' },
		{ name: '[[admin/manage/privileges:acp.settings]]' },
		{ name: '[[admin/manage/privileges:acp.appearance]]' },
		{ name: '[[admin/manage/privileges:acp.extend]]' },
		{ name: '[[admin/manage/privileges:acp.advanced]]' },
	];

	privileges.admin.userPrivilegeList = [
		'acp:general',
		'acp:manage',
		'acp:settings',
		'acp:appearance',
		'acp:extend',
		'acp:advanced',
	];

	privileges.admin.groupPrivilegeList = privileges.admin.userPrivilegeList.map(function (privilege) {
		return 'groups:' + privilege;
	});

	privileges.admin.list = function (callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					labels: function (next) {
						async.parallel({
							users: async.apply(plugins.fireHook, 'filter:privileges.admin.list_human', privileges.admin.privilegeLabels.slice()),
							groups: async.apply(plugins.fireHook, 'filter:privileges.admin.groups.list_human', privileges.admin.privilegeLabels.slice()),
						}, next);
					},
					users: function (next) {
						helpers.getUserPrivileges('acp', 'filter:privileges.admin.list', privileges.admin.userPrivilegeList, next);
					},
					groups: function (next) {
						helpers.getGroupPrivileges('acp', 'filter:privileges.admin.groups.list', privileges.admin.groupPrivilegeList, next);
					},
				}, next);
			},
			function (payload, next) {
				// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
				payload.columnCountUser = payload.labels.users.length + 2;
				payload.columnCountGroup = payload.labels.groups.length + 2;
				next(null, payload);
			},
		], callback);
	};

	privileges.admin.can = function (privilege, uid, callback) {
		helpers.some([
			function (next) {
				helpers.isUserAllowedTo(privilege, uid, ['acp'], function (err, results) {
					next(err, Array.isArray(results) && results.length ? results[0] : false);
				});
			},
			function (next) {
				user.isAdministrator(uid, next);
			},
		], callback);
	};
};
