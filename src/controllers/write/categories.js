'use strict';

const categories = require('../../categories');
const events = require('../../events');

const helpers = require('../helpers');

const Categories = module.exports;

Categories.create = async (req, res) => {
	const response = await categories.create(req.body);
	const categoryObjs = await categories.getCategories([response.cid]);
	helpers.formatApiResponse(200, res, categoryObjs[0]);
};

Categories.update = async (req, res) => {
	const payload = {};
	payload[req.params.cid] = req.body;

	await categories.update(payload);
	const categoryObjs = await categories.getCategories([req.params.cid]);
	helpers.formatApiResponse(200, res, categoryObjs[0]);
};

Categories.delete = async (req, res) => {
	const name = await categories.getCategoryField(req.params.cid, 'name');
	await categories.purge(req.params.cid, req.user.uid);
	await events.log({
		type: 'category-purge',
		uid: req.user.uid,
		ip: req.ip,
		cid: req.params.cid,
		name: name,
	});

	helpers.formatApiResponse(200, res);
};
