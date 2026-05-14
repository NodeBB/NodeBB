'use strict';

const Intents = module.exports;

const helpers = require('../helpers');

Intents.query = async (req, res) => {
	const intents = [];
	helpers.formatApiResponse(200, res, { intents });
};