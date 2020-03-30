'use strict';

const users = require('../../user');
const helpers = require('../helpers');

const Users = module.exports;

Users.create = async (req, res) => {
	const uid = await users.create(req.body);
	helpers.formatApiResponse(200, res, await users.getUserData(uid));
};
