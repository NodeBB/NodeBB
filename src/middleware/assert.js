'use strict';

/**
 * The middlewares here strictly act to "assert" validity of the incoming
 * payload and throw an error otherwise.
 */

const path = require('path');
const nconf = require('nconf');

const file = require('../file');
const user = require('../user');
const groups = require('../groups');
const topics = require('../topics');
const posts = require('../posts');

const helpers = require('./helpers');
const controllerHelpers = require('../controllers/helpers');

const Assert = module.exports;

Assert.user = helpers.try(async (req, res, next) => {
	if (!await user.exists(req.params.uid)) {
		return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-user]]'));
	}

	next();
});

Assert.group = helpers.try(async (req, res, next) => {
	const name = await groups.getGroupNameByGroupSlug(req.params.slug);
	if (!name || !await groups.exists(name)) {
		return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-group]]'));
	}

	next();
});

Assert.topic = helpers.try(async (req, res, next) => {
	if (!await topics.exists(req.params.tid)) {
		return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
	}

	next();
});

Assert.post = helpers.try(async (req, res, next) => {
	if (!await posts.exists(req.params.pid)) {
		return controllerHelpers.formatApiResponse(404, res, new Error('[[error:no-post]]'));
	}

	next();
});

Assert.path = helpers.try(async (req, res, next) => {
	// file: URL support
	if (req.body.path.startsWith('file:///')) {
		req.body.path = new URL(req.body.path).pathname;
	}

	// Strip upload_url if found
	if (req.body.path.startsWith(nconf.get('upload_url'))) {
		req.body.path = req.body.path.slice(nconf.get('upload_url').length);
	}

	const pathToFile = path.join(nconf.get('upload_path'), req.body.path);
	res.locals.cleanedPath = pathToFile;

	// Guard against path traversal
	if (!pathToFile.startsWith(nconf.get('upload_path'))) {
		return controllerHelpers.formatApiResponse(403, res, new Error('[[error:invalid-path]]'));
	}

	if (!await file.exists(pathToFile)) {
		return controllerHelpers.formatApiResponse(404, res, new Error('[[error:invalid-path]]'));
	}

	next();
});
