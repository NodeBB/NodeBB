(function(Auth) {
	"use strict";

	var passport = require('passport'),
		passportLocal = require('passport-local').Strategy,
		nconf = require('nconf'),
		winston = require('winston'),
		express = require('express'),

		controllers = require('../controllers'),
		plugins = require('../plugins'),
		hotswap = require('../hotswap'),

		loginStrategies = [];

	Auth.initialize = function(app, middleware) {
		app.use(passport.initialize());
		app.use(passport.session());

		app.use(function(req, res, next) {
			req.uid = req.user ? parseInt(req.user.uid, 10) : 0;
			next();
		});

		Auth.app = app;
		Auth.middleware = middleware;
	};

	Auth.getLoginStrategies = function() {
		return loginStrategies;
	};

	Auth.reloadRoutes = function(callback) {
		var router = express.Router();
		router.hotswapId = 'auth';

		loginStrategies.length = 0;

		if (plugins.hasListeners('action:auth.overrideLogin')) {
			winston.warn('[authentication] Login override detected, skipping local login strategy.');
			plugins.fireHook('action:auth.overrideLogin');
		} else {
			passport.use(new passportLocal({passReqToCallback: true}, controllers.authentication.localLogin));
		}

		plugins.fireHook('filter:auth.init', loginStrategies, function(err) {
			if (err) {
				winston.error('filter:auth.init - plugin failure');
				return callback(err);
			}

			loginStrategies.forEach(function(strategy) {
				if (strategy.url) {
					router.get(strategy.url, passport.authenticate(strategy.name, {
						scope: strategy.scope,
						prompt: strategy.prompt || undefined
					}));
				}

				router.get(strategy.callbackURL, passport.authenticate(strategy.name, {
					successReturnToOrRedirect: nconf.get('relative_path') + (strategy.successUrl !== undefined ? strategy.successUrl : '/'),
					failureRedirect: nconf.get('relative_path') + (strategy.failureUrl !== undefined ? strategy.failureUrl : '/login')
				}));
			});

			router.post('/register', Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist, controllers.authentication.register);
			router.post('/login', Auth.middleware.applyCSRF, Auth.middleware.applyBlacklist, controllers.authentication.login);
			router.post('/logout', Auth.middleware.applyCSRF, controllers.authentication.logout);

			hotswap.replace('auth', router);
			if (typeof callback === 'function') {
				callback();
			}
		});
	};

	passport.serializeUser(function(user, done) {
		done(null, user.uid);
	});

	passport.deserializeUser(function(uid, done) {
		done(null, {
			uid: uid
		});
	});

}(exports));
