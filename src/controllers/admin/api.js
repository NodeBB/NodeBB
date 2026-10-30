'use strict';

const api = require('../../api');
const pagination = require('../../pagination');
const utils = require('../../utils');

const controller = module.exports;

controller.get = async (req, res) => {
	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 50;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;
	const [tokens, count] = await Promise.all([
		api.utils.tokens.list(start, stop),
		api.utils.tokens.count(),
	]);
	const acpTokens = tokens.filter(Boolean).map((tokenObj) => {
		const { token, ...rest } = tokenObj;
		return {
			...rest,
			tokenId: api.utils.tokens.fingerprint(token),
			tokenMasked: utils.maskToken(token),
		};
	});
	const pageCount = Math.ceil(count / resultsPerPage);
	res.render('admin/manage/api', {
		title: '[[admin/menu:settings/api]]',
		tokens: acpTokens,
		pagination: pagination.create(page, pageCount, req.query),
	});
};