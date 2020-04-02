'use strict';

const categories = require('../../categories');

const helpers = require('../helpers');

const Categories = module.exports;

Categories.create = async (req, res) => {
	const response = await categories.create(req.body);
	const categoryObjs = await categories.getCategories([response.cid]);
	helpers.formatApiResponse(200, res, categoryObjs[0]);
};
