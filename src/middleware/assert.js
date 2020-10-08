'use strict';

/**
 * The middlewares here strictly act to "assert" validity of the incoming
 * payload and throw an error otherwise.
 */

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');

const nconf = require('nconf');

const user = require('../user');
const groups = require('../groups');
const topics = require('../topics');
const posts = require('../posts');

const helpers = require('./helpers');
const controllerHelpers = require('../controllers/helpers');

module.exports = function (middleware) {
	middleware.assertUser = helpers.try(async (req, res, next) => {
		if (!await user.exists(req.params.uid)) {
			return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-user]]'));
		}

		next();
	});

	middleware.assertGroup = helpers.try(async (req, res, next) => {
		const name = await groups.getGroupNameByGroupSlug(req.params.slug);
		if (!name || !await groups.exists(name)) {
			return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-group]]'));
		}

		next();
	});

	middleware.assertTopic = helpers.try(async (req, res, next) => {
		if (!await topics.exists(req.params.tid)) {
			return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
		}

		next();
	});

	middleware.assertPost = helpers.try(async (req, res, next) => {
		if (!await posts.exists(req.params.pid)) {
			return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
		}

		next();
	});

	middleware.assertPath = helpers.try(async (req, res, next) => {
		// file: URL support
		if (req.body.path.startsWith('file:///')) {
			req.body.path = new URL(req.body.path).pathname;
		}

		// Checks file exists and is within bounds of upload_path
		const pathToFile = path.join(nconf.get('upload_path'), req.body.path);
		res.locals.cleanedPath = pathToFile;

		if (!pathToFile.startsWith(nconf.get('upload_path'))) {
			return controllerHelpers.formatApiResponse(403, res, new Error('[[error:invalid-path]]'));
		}

		try {
			await fsPromises.access(pathToFile, fs.constants.F_OK);
		} catch (e) {
			return controllerHelpers.formatApiResponse(404, res, new Error('[[error:invalid-path]]'));
		}

		next();
	});
};
