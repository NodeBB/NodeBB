'use strict';

const nconf = require('nconf');

const user = require('../../user');
const groups = require('../../groups');
const helpers = require('../helpers');

const groupsController = module.exports;

const url = nconf.get('url');

groupsController.get = async function (req, res) {
	const { username, userslug } = await user.getUserFields(res.locals.uid, ['username', 'userslug']);

	const payload = res.locals.userData;

	const groupsData = payload.groups.filter(Boolean);
	const groupNames = groupsData.map(group => group.name);
	const members = await groups.getMemberUsers(groupNames, 0, 3);
	groupsData.forEach((group, index) => {
		group.members = members[index];
	});
	payload.groups = groupsData;
	payload.title = `[[pages:account/groups, ${username}]]`;
	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[global:header.groups]]' }]);
	res.locals.linkTags = [
		{
			rel: 'canonical',
			href: `${url}${req.url.replace(/^\/api/, '')}`,
		},
	];
	res.render('account/groups', payload);
};
