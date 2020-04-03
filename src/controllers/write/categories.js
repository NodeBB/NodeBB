'use strict';

const categories = require('../../categories');

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
