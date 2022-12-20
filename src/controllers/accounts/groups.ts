'use strict';

import groups from '../../groups';
import helpers from '../helpers';
import accountHelpers from './helpers';

const groupsController = {} as any;

groupsController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, req.query);
	if (!userData) {
		return next();
	}
	let groupsData = await groups.getUserGroups([userData.uid]);
	groupsData = groupsData[0];
	const groupNames = groupsData.filter(Boolean).map(group => group.name);
	const members = await groups.getMemberUsers(groupNames, 0, 3);
	groupsData.forEach((group, index) => {
		group.members = members[index];
	});
	userData.groups = groupsData;
	userData.title = `[[pages:account/groups, ${userData.username}]]`;
	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: `/user/${userData.userslug}` }, { text: '[[global:header.groups]]' }]);
	res.render('account/groups', userData);
};

export default groupsController;