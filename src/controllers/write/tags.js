'use strict';

const api = require('../../api');

const helpers = require('../helpers');

const Tags = module.exports;

Tags.follow = async (req, res) => {
	await api.tags.follow(req, req.params);
	helpers.formatApiResponse(200, res);
};

Tags.unfollow = async (req, res) => {
	await api.tags.unfollow(req, req.params);
	helpers.formatApiResponse(200, res);
};
