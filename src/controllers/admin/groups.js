'use strict';

const validator = require('validator');

const db = require('../../database');
const groups = require('../../groups');
const meta = require('../../meta');
const pagination = require('../../pagination');

const groupsController = module.exports;

groupsController.list = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const groupsPerPage = 20;

	let groupNames = await getGroupNames();
	const pageCount = Math.ceil(groupNames.length / groupsPerPage);
	const start = (page - 1) * groupsPerPage;
	const stop = start + groupsPerPage - 1;

	groupNames = groupNames.slice(start, stop + 1);
	const groupData = await groups.getGroupsData(groupNames);
	res.render('admin/manage/groups', {
		groups: groupData,
		pagination: pagination.create(page, pageCount),
		yourid: req.uid,
	});
};

groupsController.get = async function (req, res, next) {
	const groupName = req.params.name;
	const [groupNames, group] = await Promise.all([
		getGroupNames(),
		groups.get(groupName, { uid: req.uid, truncateUserList: true, userListCount: 20 }),
	]);

	if (!group) {
		return next();
	}
	group.isOwner = true;

	const groupNameData = groupNames.map(function (name) {
		return {
			encodedName: encodeURIComponent(name),
			displayName: validator.escape(String(name)),
			selected: name === groupName,
		};
	});

	res.render('admin/manage/group', {
		group: group,
		groupNames: groupNameData,
		allowPrivateGroups: meta.config.allowPrivateGroups,
		maximumGroupNameLength: meta.config.maximumGroupNameLength,
		maximumGroupTitleLength: meta.config.maximumGroupTitleLength,
	});
};

async function getGroupNames() {
	const groupNames = await db.getSortedSetRange('groups:createtime', 0, -1);
	return groupNames.filter(name => name !== 'registered-users' && !groups.isPrivilegeGroup(name));
}
