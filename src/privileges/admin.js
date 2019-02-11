
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

	// privileges.global.get = function (uid, callback) {
	// 	async.waterfall([
	// 		function (next) {
	// 			async.parallel({
	// 				privileges: function (next) {
	// 					helpers.isUserAllowedTo(privileges.global.userPrivilegeList, uid, 0, next);
	// 				},
	// 				isAdministrator: function (next) {
	// 					user.isAdministrator(uid, next);
	// 				},
	// 				isGlobalModerator: function (next) {
	// 					user.isGlobalModerator(uid, next);
	// 				},
	// 			}, next);
	// 		},
	// 		function (results, next) {
	// 			var privData = _.zipObject(privileges.global.userPrivilegeList, results.privileges);
	// 			var isAdminOrMod = results.isAdministrator || results.isGlobalModerator;

	// 			plugins.fireHook('filter:privileges.global.get', {
	// 				chat: privData.chat || isAdminOrMod,
	// 				'upload:post:image': privData['upload:post:image'] || isAdminOrMod,
	// 				'upload:post:file': privData['upload:post:file'] || isAdminOrMod,
	// 				'search:content': privData['search:content'] || isAdminOrMod,
	// 				'search:users': privData['search:users'] || isAdminOrMod,
	// 				'search:tags': privData['search:tags'] || isAdminOrMod,
	// 				'view:users': privData['view:users'] || isAdminOrMod,
	// 				'view:tags': privData['view:tags'] || isAdminOrMod,
	// 				'view:groups': privData['view:groups'] || isAdminOrMod,
	// 			}, next);
	// 		},
	// 	], callback);
	// };

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

	// privileges.global.canGroup = function (privilege, groupName, callback) {
	// 	groups.isMember(groupName, 'cid:0:privileges:groups:' + privilege, callback);
	// };

	// privileges.global.give = function (privileges, groupName, callback) {
	// 	helpers.giveOrRescind(groups.join, privileges, 0, groupName, callback);
	// };

	// privileges.global.rescind = function (privileges, groupName, callback) {
	// 	helpers.giveOrRescind(groups.leave, privileges, 0, groupName, callback);
	// };

	// privileges.global.userPrivileges = function (uid, callback) {
	// 	var tasks = {};

	// 	privileges.global.userPrivilegeList.forEach(function (privilege) {
	// 		tasks[privilege] = async.apply(groups.isMember, uid, 'cid:0:privileges:' + privilege);
	// 	});

	// 	async.parallel(tasks, callback);
	// };

	// privileges.global.groupPrivileges = function (groupName, callback) {
	// 	var tasks = {};

	// 	privileges.global.groupPrivilegeList.forEach(function (privilege) {
	// 		tasks[privilege] = async.apply(groups.isMember, groupName, 'cid:0:privileges:' + privilege);
	// 	});

	// 	async.parallel(tasks, callback);
	// };
};
