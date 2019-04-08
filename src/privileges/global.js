
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
		{ name: '[[admin/manage/privileges:chat]]' },
		{ name: '[[admin/manage/privileges:upload-images]]' },
		{ name: '[[admin/manage/privileges:upload-files]]' },
		{ name: '[[admin/manage/privileges:signature]]' },
		{ name: '[[admin/manage/privileges:ban]]' },
		{ name: '[[admin/manage/privileges:search-content]]' },
		{ name: '[[admin/manage/privileges:search-users]]' },
		{ name: '[[admin/manage/privileges:search-tags]]' },
		{ name: '[[admin/manage/privileges:view-users]]' },
		{ name: '[[admin/manage/privileges:view-tags]]' },
		{ name: '[[admin/manage/privileges:view-groups]]' },
		{ name: '[[admin/manage/privileges:allow-local-login]]' },
		{ name: '[[admin/manage/privileges:allow-group-creation]]' },
	];

	privileges.global.userPrivilegeList = [
		'chat',
		'upload:post:image',
		'upload:post:file',
		'signature',
		'ban',
		'search:content',
		'search:users',
		'search:tags',
		'view:users',
		'view:tags',
		'view:groups',
		'local:login',
		'group:create',
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

	privileges.global.get = function (uid, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					privileges: function (next) {
						helpers.isUserAllowedTo(privileges.global.userPrivilegeList, uid, 0, next);
					},
					isAdministrator: function (next) {
						user.isAdministrator(uid, next);
					},
					isGlobalModerator: function (next) {
						user.isGlobalModerator(uid, next);
					},
				}, next);
			},
			function (results, next) {
				var privData = _.zipObject(privileges.global.userPrivilegeList, results.privileges);
				var isAdminOrMod = results.isAdministrator || results.isGlobalModerator;

				plugins.fireHook('filter:privileges.global.get', {
					chat: privData.chat || isAdminOrMod,
					'upload:post:image': privData['upload:post:image'] || isAdminOrMod,
					'upload:post:file': privData['upload:post:file'] || isAdminOrMod,
					'search:content': privData['search:content'] || isAdminOrMod,
					'search:users': privData['search:users'] || isAdminOrMod,
					'search:tags': privData['search:tags'] || isAdminOrMod,
					'view:users': privData['view:users'] || isAdminOrMod,
					'view:tags': privData['view:tags'] || isAdminOrMod,
					'view:groups': privData['view:groups'] || isAdminOrMod,
				}, next);
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

	privileges.global.canGroup = function (privilege, groupName, callback) {
		groups.isMember(groupName, 'cid:0:privileges:groups:' + privilege, callback);
	};

	privileges.global.give = function (privileges, groupName, callback) {
		helpers.giveOrRescind(groups.join, privileges, 0, groupName, callback);
	};

	privileges.global.rescind = function (privileges, groupName, callback) {
		helpers.giveOrRescind(groups.leave, privileges, 0, groupName, callback);
	};

	privileges.global.userPrivileges = function (uid, callback) {
		var tasks = {};

		privileges.global.userPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = async.apply(groups.isMember, uid, 'cid:0:privileges:' + privilege);
		});

		async.parallel(tasks, callback);
	};

	privileges.global.groupPrivileges = function (groupName, callback) {
		var tasks = {};

		privileges.global.groupPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = async.apply(groups.isMember, groupName, 'cid:0:privileges:' + privilege);
		});

		async.parallel(tasks, callback);
	};
};
