'use strict';

const db = require('../../database');
const helpers = require('../helpers');

const tagsController = module.exports;

tagsController.get = async function (req, res) {
	if (req.uid !== res.locals.uid) {
		return helpers.notAllowed(req, res);
	}
	const payload = res.locals.userData;
	const { username, userslug } = payload;
	const tagData = await db.getSortedSetRange(`uid:${res.locals.uid}:followed_tags`, 0, -1);

	payload.tags = tagData;
	payload.title = `[[pages:account/watched-tags, ${username}]]`;
	payload.breadcrumbs = helpers.buildBreadcrumbs([
		{ text: username, url: `/user/${userslug}` },
		{ text: '[[pages:tags]]' },
	]);

	res.render('account/tags', payload);
};
