'use strict';

const helpers = require('../helpers');
const pagination = require('../../pagination');
const user = require('../../user');
const plugins = require('../../plugins');

const blocksController = module.exports;

blocksController.getBlocks = async function (req, res) {
	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 50;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;
	const payload = res.locals.userData;
	const { uid, username, userslug, blocksCount } = payload;

	const uids = await user.blocks.list(uid);
	const data = await plugins.hooks.fire('filter:user.getBlocks', {
		uids: uids,
		uid: uid,
		start: start,
		stop: stop,
	});

	data.uids = data.uids.slice(start, stop + 1);
	payload.users = await user.getUsers(data.uids, req.uid);
	payload.title = `[[pages:account/blocks, ${username}]]`;

	const pageCount = Math.ceil(blocksCount / resultsPerPage);
	payload.pagination = pagination.create(page, pageCount);

	payload.breadcrumbs = helpers.buildBreadcrumbs([{ text: username, url: `/user/${userslug}` }, { text: '[[user:blocks]]' }]);

	res.render('account/blocks', payload);
};
