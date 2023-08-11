'use strict';

const helpers = require('../helpers');
const api = require('../../api');

const Files = module.exports;

Files.delete = async (req, res) => {
	await api.files.delete(req, { path: res.locals.cleanedPath });
	helpers.formatApiResponse(200, res);
};

Files.createFolder = async (req, res) => {
	await api.files.createFolder(req, { path: res.locals.folderPath });
	helpers.formatApiResponse(200, res);
};
