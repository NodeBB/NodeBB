'use strict';

const api = require('../../api');
const helpers = require('../helpers');

const Search = module.exports;

Search.categories = async (req, res) => {
	helpers.formatApiResponse(200, res, await api.search.categories(req, req.query));
};

Search.roomUsers = async (req, res) => {
	const { query, uid } = req.query;
	helpers.formatApiResponse(200, res, await api.search.roomUsers(req, { query, uid, ...req.params }));
};

Search.roomMessages = async (req, res) => {
	const { query } = req.query;
	helpers.formatApiResponse(200, res, await api.search.roomMessages(req, { query, ...req.params }));
};
