'use strict';

const async = require('async');
const passport = require('passport');
const passportLocal = require('passport-local').Strategy;
const BearerStrategy = require('passport-http-bearer').Strategy;
const winston = require('winston');

const meta = require('../meta');
const controllers = require('../controllers');
const helpers = require('../controllers/helpers');
const plugins = require('../plugins');

let loginStrategies = [];

const Auth = module.exports;

Auth.initialize = function (app, middleware) {
	const passportInitMiddleware = passport.initialize();
	app.use((req, res, next) => {
		passportInitMiddleware(req, res, next);
	});
	const passportSessionMiddleware = passport.session();
	app.use((req, res, next) => {
		passportSessionMiddleware(req, res, next);
	});

	app.use((req, res, next) => {
		Auth.setAuthVars(req, res);
		next();
	});

	Auth.app = app;
	Auth.middleware = middleware;
};

Auth.setAuthVars = function setAuthVars(req) {
	const isSpider = req.isSpider();
	req.loggedIn = !isSpider && !!req.user;
	if (req.user) {
		req.uid = parseInt(req.user.uid, 10);
	} else if (isSpider) {
		req.uid = -1;
	} else {
		req.uid = 0;
	}
};

Auth.getLoginStrategies = function () {
	return loginStrategies;
};

Auth.verifyToken = async function (token, done) {
	let { tokens } = await meta.settings.get('core.api');
	tokens = tokens.reduce((memo, cur) => {
		memo[cur.token] = cur.uid;
		return memo;
	}, {});

	const uid = tokens[token];

	if (uid !== undefined) {
		if (parseInt(uid, 10) > 0) {
			done(null, {
				uid: uid,
			});
		} else {
			done(null, {
				master: true,
			});
		}
	} else {
		done(false);
	}
};

Auth.reloadRoutes = async function (params) {
	loginStrategies.length = 0;
	const router = params.router;

	// Local Logins
	if (plugins.hooks.hasListeners('action:auth.overrideLogin')) {
		winston.warn('[authentication] Login override detected, skipping local login strategy.');
		plugins.hooks.fire('action:auth.overrideLogin');
	} else {
		passport.use(new passportLocal({ passReqToCallback: true }, controllers.authentication.localLogin));
	}

	// HTTP bearer authentication
	passport.use('core.api', new BearerStrategy({}, Auth.verifyToken));

	// Additional logins via SSO plugins
	try {
		loginStrategies = await plugins.hooks.fire('filter:auth.init', loginStrategies);
	} catch (err) {
		winston.error(`[authentication] ${err.stack}`);
	}
	loginStrategies = loginStrategies || [];
	loginStrategies.forEach((strategy) => {
		if (strategy.url) {
			router.get(strategy.url, Auth.middleware.applyCSRF, async (req, res, next) => {
				let opts = {
					scope: strategy.scope,
					prompt: strategy.prompt || undefined,
				};

				if (strategy.checkState) {
					req.session.ssoState = req.csrfToken && req.csrfToken();
					opts.state = req.session.ssoState;
				}

				// Allow SSO plugins to override/append options (for use in passport prototype authorizationParams)
				({ opts } = await plugins.hooks.fire('filter:auth.options', { req, res, opts }));

				passport.authenticate(strategy.name, opts)(req, res, next);
			});
		}

		router[strategy.callbackMethod || 'get'](strategy.callbackURL, (req, res, next) => {
			// Ensure the passed-back state value is identical to the saved ssoState (unless explicitly skipped)
			if (strategy.checkState === false) {
				return next();
			}

			next(req.query.state !== req.session.ssoState ? new Error('[[error:csrf-invalid]]') : null);
		}, (req, res, next) => {
			// Trigger registration interstitial checks
			req.session.registration = req.session.registration || {};
			// save returnTo for later usage in /register/complete
			// passport seems to remove `req.session.returnTo` after it redirects
			req.session.registration.returnTo = req.session.returnTo;

			passport.authenticate(strategy.name, (err, user) => {
				if (err) {
					delete req.session.registration;
					return next(err);
				}

				if (!user) {
					delete req.session.registration;
					return helpers.redirect(res, strategy.failureUrl !== undefined ? strategy.failureUrl : '/login');
				}

				res.locals.user = user;
				res.locals.strategy = strategy;
				next();
			})(req, res, next);
		},
		Auth.middleware.validateAuth,
		(req, res, next) => {
			async.waterfall([
				async.apply(req.login.bind(req), res.locals.user),
				async.apply(controllers.authentication.onSuccessfulLogin, req, req.uid),
			], (err) => {
				if (err) {
					return next(err);
				}

				helpers.redirect(res, strategy.successUrl !== undefined ? strategy.successUrl : '/');
			});
		});
	});

	const multipart = require('connect-multiparty');
	const multipartMiddleware = multipart();
	const middlewares = [multipartMiddleware, Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist];

	router.post('/register', middlewares, controllers.authentication.register);
	router.post('/register/complete', middlewares, controllers.authentication.registerComplete);
	router.post('/register/abort', controllers.authentication.registerAbort);
	router.post('/login', Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist, controllers.authentication.login);
	router.post('/logout', Auth.middleware.applyCSRF, controllers.authentication.logout);
};

passport.serializeUser((user, done) => {
	done(null, user.uid);
});

passport.deserializeUser((uid, done) => {
	done(null, {
		uid: uid,
	});
});
