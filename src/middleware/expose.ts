'use strict';

/**
 * The middlewares here strictly act to "expose" certain values from the database,
 * into `res.locals` for use in middlewares and/or controllers down the line
 */

const user = require('../user');
const privileges = require('../privileges');
const utils = require('../utils');

module.exports = function (middleware) {
	middleware.exposeAdmin = async (req, res, next) => {
		// Unlike `requireAdmin`, this middleware just checks the uid, and sets `isAdmin` in `res.locals`
		res.locals.isAdmin = false;

		if (!req.user) {
			return next();
		}

		res.locals.isAdmin = await user.isAdministrator(req.user.uid);
		next();
	};

	middleware.exposePrivileges = async (req, res, next) => {
		// Exposes a hash of user's ranks (admin, gmod, etc.)
		const hash = await utils.promiseParallel({
			isAdmin: user.isAdministrator(req.user.uid),
			isGmod: user.isGlobalModerator(req.user.uid),
			isPrivileged: user.isPrivileged(req.user.uid),
		});

		if (req.params.uid) {
			hash.isSelf = parseInt(req.params.uid, 10) === req.user.uid;
		}

		res.locals.privileges = hash;
		next();
	};

	middleware.exposePrivilegeSet = async (req, res, next) => {
		// Exposes a user's global/admin privilege set
		res.locals.privileges = {
			...await privileges.global.get(req.user.uid),
			...await privileges.admin.get(req.user.uid),
		};
		next();
	};
};
