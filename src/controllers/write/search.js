'use strict';

const api = require('../../api');
const helpers = require('../helpers');

const Search = module.exports;

Search.categories = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.search.categories(req, req.query));
};
