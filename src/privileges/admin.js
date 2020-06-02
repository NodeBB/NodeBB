
'use strict';

// const _ = require('lodash');

// const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

module.exports = function (privileges) {
	privileges.admin = {};

	privileges.admin.privilegeLabels = [
		{ name: '[[admin/manage/privileges:manage-categories]]' },
	];

	privileges.admin.userPrivilegeList = [
		'manage:categories',
	];

	privileges.admin.groupPrivilegeList = privileges.admin.userPrivilegeList.map(privilege => 'groups:' + privilege);

	// Mapping for a page route (via direct match or regexp) to a privilege
	privileges.admin.routeMap = {
		'manage/categories': 'manage:categories',
	};
	privileges.admin.routeRegexpMap = {
		'^manage/categories/\\d+': 'manage:categories',
	};

	// Mapping for socket call methods to a privilege
	privileges.admin.socketMap = {
		'admin.categories.getAll': 'manage:categories',
		'admin.categories.create': 'manage:categories',
		'admin.categories.update': 'manage:categories',
		'admin.categories.purge': 'manage:categories',
		'admin.categories.copySettingsFrom': 'manage:categories',
	};

	privileges.admin.resolve = (path) => {
		if (privileges.admin.routeMap[path]) {
			return privileges.admin.routeMap[path];
		}

		let privilege;
		Object.keys(privileges.admin.routeRegexpMap).forEach((regexp) => {
			if (!privilege) {
				console.log('here', new RegExp(regexp), path);
				if (new RegExp(regexp).test(path)) {
					privilege = privileges.admin.routeRegexpMap[regexp];
				}
			}
		});

		return privilege;
	};

	privileges.admin.list = async function () {
		async function getLabels() {
			return await utils.promiseParallel({
				users: plugins.fireHook('filter:privileges.admin.list_human', privileges.admin.privilegeLabels.slice()),
				groups: plugins.fireHook('filter:privileges.admin.groups.list_human', privileges.admin.privilegeLabels.slice()),
			});
		}
		const payload = await utils.promiseParallel({
			labels: getLabels(),
			users: helpers.getUserPrivileges(0, 'filter:privileges.admin.list', privileges.admin.userPrivilegeList),
			groups: helpers.getGroupPrivileges(0, 'filter:privileges.admin.groups.list', privileges.admin.groupPrivilegeList),
		});
		// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
		payload.columnCount = payload.labels.users.length + 2;
		return payload;
	};

	// privileges.admin.get = async function (uid) {
	// 	const [userPrivileges, isAdministrator] = await Promise.all([
	// 		helpers.isUserAllowedTo(privileges.admin.userPrivilegeList, uid, 0),
	// 		user.isAdministrator(uid),
	// 	]);

	// 	const privData = _.zipObject(privileges.admin.userPrivilegeList, userPrivileges);

	// 	return await plugins.fireHook('filter:privileges.admin.get', {
	// 		chat: privData.chat || isAdministrator,
	// 		'upload:post:image': privData['upload:post:image'] || isAdministrator,
	// 		'upload:post:file': privData['upload:post:file'] || isAdministrator,
	// 		'search:content': privData['search:content'] || isAdministrator,
	// 		'search:users': privData['search:users'] || isAdministrator,
	// 		'search:tags': privData['search:tags'] || isAdministrator,
	// 		'view:users': privData['view:users'] || isAdministrator,
	// 		'view:tags': privData['view:tags'] || isAdministrator,
	// 		'view:groups': privData['view:groups'] || isAdministrator,
	// 		'view:users:info': privData['view:users:info'] || isAdministrator,
	// 	});
	// };

	privileges.admin.can = async function (privilege, uid) {
		const isUserAllowedTo = await helpers.isUserAllowedTo(privilege, uid, [0]);
		return isUserAllowedTo[0];
	};

	// privileges.admin.canGroup = async function (privilege, groupName) {
	// 	return await groups.isMember(groupName, 'cid:0:privileges:groups:' + privilege);
	// };

	privileges.admin.give = async function (privileges, groupName) {
		await helpers.giveOrRescind(groups.join, privileges, 'admin', groupName);
		plugins.fireHook('action:privileges.admin.give', {
			privileges: privileges,
			groupNames: Array.isArray(groupName) ? groupName : [groupName],
		});
	};

	privileges.admin.rescind = async function (privileges, groupName) {
		await helpers.giveOrRescind(groups.leave, privileges, 'admin', groupName);
		plugins.fireHook('action:privileges.admin.rescind', {
			privileges: privileges,
			groupNames: Array.isArray(groupName) ? groupName : [groupName],
		});
	};

	// privileges.admin.userPrivileges = async function (uid) {
	// 	const tasks = {};
	// 	privileges.admin.userPrivilegeList.forEach(function (privilege) {
	// 		tasks[privilege] = groups.isMember(uid, 'cid:0:privileges:' + privilege);
	// 	});
	// 	return await utils.promiseParallel(tasks);
	// };

	// privileges.admin.groupPrivileges = async function (groupName) {
	// 	const tasks = {};
	// 	privileges.admin.groupPrivilegeList.forEach(function (privilege) {
	// 		tasks[privilege] = groups.isMember(groupName, 'cid:0:privileges:' + privilege);
	// 	});
	// 	return await utils.promiseParallel(tasks);
	// };
};
