'use strict';

const passport = require('passport');
const winston = require('winston');

const helpers = require('../controllers/helpers');
const middleware = module.exports;

middleware.authenticate = function (req, res, next) {
	if (req.headers.hasOwnProperty('authorization')) {
		passport.authenticate('bearer', { session: false }, function (err, user) {
			if (err) { return next(err); }
			if (!user) { return helpers.formatApiResponse(401, res); }

			// If the token received was a master token, a _uid must also be present for all calls
			if (user.hasOwnProperty('uid')) {
				req.login(user, function (err) {
					if (err) { return helpers.formatApiResponse(500, res, err); }

					req.uid = user.uid;
					req.loggedIn = req.uid > 0;
					next();
				});
			} else if (user.hasOwnProperty('master') && user.master === true) {
				if (req.body.hasOwnProperty('_uid') || req.query.hasOwnProperty('_uid')) {
					user.uid = req.body._uid || req.query._uid;
					delete user.master;

					req.login(user, function (err) {
						if (err) { return helpers.formatApiResponse(500, res, err); }

						req.uid = user.uid;
						req.loggedIn = req.uid > 0;
						next();
					});
				} else {
					return helpers.formatApiResponse(400, res, new Error('A master token was received without a corresponding `_uid` in the request body'));
				}
			} else {
				winston.warn('[api/authenticate] Unable to find user after verifying token');
				helpers.formatApiResponse(500, res);
			}
		})(req, res, next);
	} else {
		// No bearer token, reject request
		helpers.formatApiResponse(401, res);
	}
};
