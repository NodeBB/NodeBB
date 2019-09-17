
'use strict';

const _ = require('lodash');

const user = require('../user');
const groups = require('../groups');
const helpers = require('./helpers');
const plugins = require('../plugins');
const utils = require('../utils');

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
		{ name: '[[admin/manage/privileges:view-users-info]]' },
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
		'view:users:info',
	];

	privileges.global.groupPrivilegeList = privileges.global.userPrivilegeList.map(privilege => 'groups:' + privilege);

	privileges.global.list = async function () {
		async function getLabels() {
			return await utils.promiseParallel({
				users: plugins.fireHook('filter:privileges.global.list_human', privileges.global.privilegeLabels.slice()),
				groups: plugins.fireHook('filter:privileges.global.groups.list_human', privileges.global.privilegeLabels.slice()),
			});
		}
		const payload = await utils.promiseParallel({
			labels: getLabels(),
			users: helpers.getUserPrivileges(0, 'filter:privileges.global.list', privileges.global.userPrivilegeList),
			groups: helpers.getGroupPrivileges(0, 'filter:privileges.global.groups.list', privileges.global.groupPrivilegeList),
		});
		// This is a hack because I can't do {labels.users.length} to echo the count in templates.js
		payload.columnCount = payload.labels.users.length + 2;
		return payload;
	};

	privileges.global.get = async function (uid) {
		const [userPrivileges, isAdministrator] = await Promise.all([
			helpers.isUserAllowedTo(privileges.global.userPrivilegeList, uid, 0),
			user.isAdministrator(uid),
		]);

		const privData = _.zipObject(privileges.global.userPrivilegeList, userPrivileges);

		return await plugins.fireHook('filter:privileges.global.get', {
			chat: privData.chat || isAdministrator,
			'upload:post:image': privData['upload:post:image'] || isAdministrator,
			'upload:post:file': privData['upload:post:file'] || isAdministrator,
			'search:content': privData['search:content'] || isAdministrator,
			'search:users': privData['search:users'] || isAdministrator,
			'search:tags': privData['search:tags'] || isAdministrator,
			'view:users': privData['view:users'] || isAdministrator,
			'view:tags': privData['view:tags'] || isAdministrator,
			'view:groups': privData['view:groups'] || isAdministrator,
			'view:users:info': privData['view:users:info'] || isAdministrator,
		});
	};

	privileges.global.can = async function (privilege, uid) {
		const [isAdministrator, isUserAllowedTo] = await Promise.all([
			user.isAdministrator(uid),
			helpers.isUserAllowedTo(privilege, uid, [0]),
		]);
		return isAdministrator || isUserAllowedTo[0];
	};

	privileges.global.canGroup = async function (privilege, groupName) {
		return await groups.isMember(groupName, 'cid:0:privileges:groups:' + privilege);
	};

	privileges.global.give = async function (privileges, groupName) {
		await helpers.giveOrRescind(groups.join, privileges, 0, groupName);
	};

	privileges.global.rescind = async function (privileges, groupName) {
		await helpers.giveOrRescind(groups.leave, privileges, 0, groupName);
	};

	privileges.global.userPrivileges = async function (uid) {
		const tasks = {};
		privileges.global.userPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = groups.isMember(uid, 'cid:0:privileges:' + privilege);
		});
		return await utils.promiseParallel(tasks);
	};

	privileges.global.groupPrivileges = async function (groupName) {
		const tasks = {};
		privileges.global.groupPrivilegeList.forEach(function (privilege) {
			tasks[privilege] = groups.isMember(groupName, 'cid:0:privileges:' + privilege);
		});
		return await utils.promiseParallel(tasks);
	};
};
