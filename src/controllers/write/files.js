'use strict';

const fs = require('fs').promises;
const helpers = require('../helpers');

const Files = module.exports;

Files.delete = async (req, res) => {
	await fs.unlink(res.locals.cleanedPath);
	helpers.formatApiResponse(200, res);
};
