'use strict';

const { getActor, mocks, get } = require('../../activitypub');
const helpers = require('../helpers');
const pagination = require('../../pagination');

const controller = module.exports;

controller.get = async function (req, res, next) {
	if (req.uid === -1) {
		return helpers.notAllowed(req, res);
	}

	const { userslug: uid } = req.params;
	const actor = await getActor(req.uid, uid);
	if (!actor) {
		return next();
	}

	const payload = await mocks.profile(actor, req.uid);
	res.render('account/profile', payload);
};

controller.getFollow = async function (tpl, name, req, res) {
	if (req.uid === -1) {
		return helpers.notAllowed(req, res);
	}

	const actor = await getActor(req.uid, req.params.userslug);

	const { userslug } = req.params;
	const { preferredUsername: username, followerCount, followingCount } = actor;

	const page = parseInt(req.query.page, 10) || 1;

	const payload = {
		...await mocks.profile(actor, req.uid),
	};
	payload.title = `[[pages:${tpl}, ${username}]]`;

	const collection = await get(req.uid, `${actor[name]}?page=${page}`);
	const resultsPerPage = collection.orderedItems.length;
	payload.users = await mocks.profile(collection.orderedItems, req.uid);

	const count = name === 'following' ? followingCount : followerCount;
	const pageCount = Math.ceil(count / resultsPerPage);
	payload.pagination = pagination.create(page, pageCount);

	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: `[[user:${name}]]` }]);

	res.render(tpl, payload);
};
