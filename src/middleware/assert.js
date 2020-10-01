'use strict';

/**
 * The middlewares here strictly act to "assert" validity of the incoming
 * payload and throw an error otherwise.
 */

const groups = require('../groups');

module.exports = function (middleware) {
	middleware.assertGroup = async (req, res, next) => {
		const name = await groups.getGroupNameByGroupSlug(req.params.slug);
		const exists = await groups.exists(name);
		if (!exists) {
			throw new Error('[[error:no-group]]');
		}

		next();
	};
};
