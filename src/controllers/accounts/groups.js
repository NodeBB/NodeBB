'use strict';

const groups = require('../../groups');
const helpers = require('../helpers');
const accountHelpers = require('./helpers');

const groupsController = module.exports;

groupsController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}
	let groupsData = await groups.getUserGroups([userData.uid]);
	groupsData = groupsData[0];
	const groupNames = groupsData.filter(Boolean).map(group => group.name);
	const members = await groups.getMemberUsers(groupNames, 0, 3);
	groupsData.forEach(function (group, index) {
		group.members = members[index];
	});
	userData.groups = groupsData;
	userData.title = '[[pages:account/groups, ' + userData.username + ']]';
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[global:header.groups]]' }]);
	res.render('account/groups', userData);
};
