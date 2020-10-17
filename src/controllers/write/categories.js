'use strict';

const categories = require('../../categories');
const api = require('../../api');

const helpers = require('../helpers');

const Categories = module.exports;

Categories.create = async (req, res) => {
	const response = await api.categories.create(req, req.body);
	helpers.formatApiResponse(200, res, response);
};

Categories.update = async (req, res) => {
	const payload = {};
	payload[req.params.cid] = req.body;
	await api.categories.update(req, payload);
	const categoryObjs = await categories.getCategories([req.params.cid]);
	helpers.formatApiResponse(200, res, categoryObjs[0]);
};

Categories.delete = async (req, res) => {
	await api.categories.delete(req, { cid: req.params.cid });
	helpers.formatApiResponse(200, res);
};
