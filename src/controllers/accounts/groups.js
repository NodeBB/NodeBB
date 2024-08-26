'use strict';

const user = require('../../user');
const groups = require('../../groups');
const helpers = require('../helpers');

const groupsController = module.exports;

groupsController.get = async function (req, res) {
	const { username, userslug } = await user.getUserFields(res.locals.uid, ['username', 'userslug']);

	const payload = res.locals.userData;

	let groupsData = await groups.getUserGroups([res.locals.uid]);
	groupsData = groupsData[0];
	const groupNames = groupsData.filter(Boolean).map(group => group.name);
	const members = await groups.getMemberUsers(groupNames, 0, 3);
	groupsData.forEach((group, index) => {
		group.members = members[index];
	});
	payload.groups = groupsData;
	payload.title = `[[pages:account/groups, ${username}]]`;
	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[global:header.groups]]' }]);
	res.render('account/groups', payload);
};
