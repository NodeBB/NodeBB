'use strict';

const pagination = require('../../pagination');
const oauth = require('../../oauth');

const controller = module.exports;

controller.get = async (req, res) => {
	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 25;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	const [clients, count] = await Promise.all([
		oauth.clients.list(start, stop),
		oauth.clients.count(),
	]);
	const pageCount = Math.ceil(count / resultsPerPage);

	res.render('admin/manage/oauth', {
		title: '[[admin/menu:manage/oauth]]',
		clients: clients.map(oauth.clients.formatForAdmin),
		scopes: oauth.scopeNames.map(name => ({ name, description: oauth.scopes[name] })),
		grants: oauth.clients.SUPPORTED_GRANTS,
		pagination: pagination.create(page, pageCount, req.query),
	});
};
