'use strict';

/**
 * The middlewares here strictly act to "expose" certain values from the database,
 * into `res.locals` for use in middlewares and/or controllers down the line
 */

const user = require('../user');
const privileges = require('../privileges');

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
		const [isAdmin, isGmod, isPrivileged] = await Promise.all([
			user.isAdministrator(req.uid),
			user.isGlobalModerator(req.uid),
			user.isPrivileged(req.uid),
		]);

		res.locals.privileges = {
			isAdmin,
			isGmod,
			isPrivileged,
			isSelf: req.params.uid ? req.params.uid === String(req.uid) : false,
		};
		next();
	};

	middleware.exposePrivilegeSet = async (req, res, next) => {
		const [globalPrivs, adminPrivs] = await Promise.all([
			privileges.global.get(req.uid),
			privileges.admin.get(req.uid),
		]);
		res.locals.privileges = { ...globalPrivs, ...adminPrivs };
		next();
	};
};
