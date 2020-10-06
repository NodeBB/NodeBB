'use strict';

/**
 * The middlewares here strictly act to "assert" validity of the incoming
 * payload and throw an error otherwise.
 */

const user = require('../user');
const groups = require('../groups');
const topics = require('../topics');
const posts = require('../posts');

const helpers = require('../controllers/helpers');

module.exports = function (middleware) {
	middleware.assertUser = async (req, res, next) => {
		if (!await user.exists(req.params.uid)) {
			return helpers.formatApiResponse(404, res, new Error('[[error:no-user]]'));
		}

		next();
	};

	middleware.assertGroup = async (req, res, next) => {
		const name = await groups.getGroupNameByGroupSlug(req.params.slug);
		if (!name || !await groups.exists(name)) {
			return helpers.formatApiResponse(404, res, new Error('[[error:no-group]]'));
		}

		next();
	};

	middleware.assertTopic = async (req, res, next) => {
		if (!await topics.exists(req.params.tid)) {
			return helpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
		}

		next();
	};

	middleware.assertPost = async (req, res, next) => {
		if (!await posts.exists(req.params.pid)) {
			return helpers.formatApiResponse(404, res, new Error('[[error:no-topic]]'));
		}

		next();
	};
};
