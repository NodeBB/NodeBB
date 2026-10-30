'use strict';

const router = require('express').Router();
const middleware = require('../../middleware');
const controllers = require('../../controllers');
const routeHelpers = require('../helpers');

const { setupApiRoute } = routeHelpers;

module.exports = function () {
	// The "ping" routes are mounted at root level, but for organizational purposes, the controllers are in `utilities.js`

	// This route skips authenticateRequest (see the skip list in middleware.user),
	// so req.uid is never set and the CSRF gate (which checks req.uid >= 0) is
	// bypassed. Set req.uid from the session so CSRF protection applies, preventing
	// cross-site login and anonymous account lockout.
	setupApiRoute(router, 'post', '/login', [
		(req, res, next) => {
			if (req.uid === undefined) {
				req.uid = req.user ? parseInt(req.user.uid, 10) : 0;
				req.loggedIn = !!req.user;
			}
			next();
		},
		middleware.applyCSRF,
		middleware.checkRequired.bind(null, ['username', 'password']),
	], controllers.write.utilities.login);

	return router;
};
