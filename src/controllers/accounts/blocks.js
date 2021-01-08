'use strict';

const helpers = require('../helpers');
const accountHelpers = require('./helpers');
const pagination = require('../../pagination');
const user = require('../../user');
const plugins = require('../../plugins');

const blocksController = module.exports;

blocksController.getBlocks = async function (req, res, next) {
	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 50;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}
	const uids = await user.blocks.list(userData.uid);
	const data = await plugins.hooks.fire('filter:user.getBlocks', {
		uids: uids,
		uid: userData.uid,
		start: start,
		stop: stop,
	});

	data.uids = data.uids.slice(start, stop + 1);
	userData.users = await user.getUsers(data.uids, req.uid);
	userData.title = '[[pages:account/blocks, ' + userData.username + ']]';

	const pageCount = Math.ceil(userData.counts.blocks / resultsPerPage);
	userData.pagination = pagination.create(page, pageCount);

	userData.breadcrumbs = helpers.buildBreadcrumbs([{ text: userData.username, url: '/user/' + userData.userslug }, { text: '[[user:blocks]]' }]);

	res.render('account/blocks', userData);
};
