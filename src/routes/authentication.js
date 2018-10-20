'use strict';

var async = require('async');
var passport = require('passport');
var passportLocal = require('passport-local').Strategy;
var nconf = require('nconf');
var winston = require('winston');
var express = require('express');

var controllers = require('../controllers');
var plugins = require('../plugins');
var hotswap = require('../hotswap');

var loginStrategies = [];

var Auth = module.exports;

Auth.initialize = function (app, middleware) {
	app.use(passport.initialize());
	app.use(passport.session());

	app.use(Auth.setAuthVars);

	Auth.app = app;
	Auth.middleware = middleware;
};

Auth.setAuthVars = function (req, res, next) {
	var isSpider = req.isSpider();
	req.loggedIn = !isSpider && !!req.user;
	if (isSpider) {
		req.uid = -1;
	} else if (req.user) {
		req.uid = parseInt(req.user.uid, 10);
	} else {
		req.uid = 0;
	}
	next();
};

Auth.getLoginStrategies = function () {
	return loginStrategies;
};

Auth.reloadRoutes = function (callback) {
	var router = express.Router();
	router.hotswapId = 'auth';

	loginStrategies.length = 0;

	if (plugins.hasListeners('action:auth.overrideLogin')) {
		winston.warn('[authentication] Login override detected, skipping local login strategy.');
		plugins.fireHook('action:auth.overrideLogin');
	} else {
		passport.use(new passportLocal({ passReqToCallback: true }, controllers.authentication.localLogin));
	}

	async.waterfall([
		function (next) {
			plugins.fireHook('filter:auth.init', loginStrategies, next);
		},
		function (loginStrategies, next) {
			loginStrategies.forEach(function (strategy) {
				if (strategy.url) {
					router.get(strategy.url, Auth.middleware.applyCSRF, function (req, res, next) {
						req.session.ssoState = req.csrfToken();
						passport.authenticate(strategy.name, {
							scope: strategy.scope,
							prompt: strategy.prompt || undefined,
							state: req.session.ssoState,
						})(req, res, next);
					});
				}

				router.get(strategy.callbackURL, function (req, res, next) {
					// Ensure the passed-back state value is identical to the saved ssoState
					next(req.query.state !== req.session.ssoState ? new Error('[[error:csrf-invalid]]') : null);
				}, function (req, res, next) {
					// Trigger registration interstitial checks
					req.session.registration = req.session.registration || {};
					next();
				}, passport.authenticate(strategy.name, {
					successReturnToOrRedirect: nconf.get('relative_path') + (strategy.successUrl !== undefined ? strategy.successUrl : '/'),
					failureRedirect: nconf.get('relative_path') + (strategy.failureUrl !== undefined ? strategy.failureUrl : '/login'),
				}));
			});

			router.post('/register', Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist, controllers.authentication.register);
			router.post('/register/complete', Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist, controllers.authentication.registerComplete);
			// router.get('/register/abort', controllers.authentication.registerAbort);
			router.post('/register/abort', controllers.authentication.registerAbort);
			router.post('/login', Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist, controllers.authentication.login);
			router.post('/logout', Auth.middleware.applyCSRF, controllers.authentication.logout);

			hotswap.replace('auth', router);
			next();
		},
	], callback);
};

passport.serializeUser(function (user, done) {
	done(null, user.uid);
});

passport.deserializeUser(function (uid, done) {
	done(null, {
		uid: uid,
	});
});
