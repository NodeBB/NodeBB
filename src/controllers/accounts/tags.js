'use strict';

const db = require('../../database');
const user = require('../../user');
const helpers = require('../helpers');

const tagsController = module.exports;

tagsController.get = async function (req, res) {
	if (req.uid !== res.locals.uid) {
		return helpers.notAllowed(req, res);
	}
	const { username, userslug } = await user.getUserFields(res.locals.uid, ['username', 'userslug']);
	const tagData = await db.getSortedSetRange(`uid:${res.locals.uid}:followed_tags`, 0, -1);

	const payload = {};
	payload.tags = tagData;
	payload.title = `[[pages:account/watched-tags, ${username}]]`;
	payload.breadcrumbs = helpers.buildBreadcrumbs([
		{ text: username, url: `/user/${userslug}` },
		{ text: '[[pages:tags]]' },
	]);

	res.render('account/tags', payload);
};
