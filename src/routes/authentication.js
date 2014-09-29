(function(Auth) {
	"use strict";

	var passport = require('passport'),
		passportLocal = require('passport-local').Strategy,
		nconf = require('nconf'),
		Password = require('../password'),
		winston = require('winston'),
		async = require('async'),
		express = require('express'),

		meta = require('../meta'),
		user = require('../user'),
		plugins = require('../plugins'),
		db = require('../database'),
		hotswap = require('../hotswap'),
		utils = require('../../public/src/utils'),

		login_strategies = [],
		controllers = require('../controllers');

	function logout(req, res) {
		if (req.user && parseInt(req.user.uid, 10) > 0) {
			winston.info('[Auth] Session ' + req.sessionID + ' logout (uid: ' + req.user.uid + ')');

			var ws = require('../socket.io');
			ws.logoutUser(req.user.uid);

			req.logout();
		}

		res.send(200);
	}

	function login(req, res, next) {
		var continueLogin = function() {
			passport.authenticate('local', function(err, userData, info) {
				if (err) {
					req.flash('error', info);
					return res.redirect(nconf.get('relative_path') + '/login');
				}

				if (!userData) {
					if (typeof info === 'object') {
						info = '[[error:invalid-username-or-password]]';
					}

					req.flash('error', info);
					return res.redirect(nconf.get('relative_path') + '/login');
				}

				// Alter user cookie depending on passed-in option
				if (req.body.remember === 'on') {
					var duration = 1000*60*60*24*parseInt(meta.config.loginDays || 14, 10);
					req.session.cookie.maxAge = duration;
					req.session.cookie.expires = new Date(Date.now() + duration);
				} else {
					req.session.cookie.maxAge = false;
					req.session.cookie.expires = false;
				}

				req.login({
					uid: userData.uid
				}, function() {
					if (userData.uid) {
						user.logIP(userData.uid, req.ip);

						plugins.fireHook('action:user.loggedIn', userData.uid);
					}

					if (!req.session.returnTo) {
						res.redirect(nconf.get('relative_path') + '/');
					} else {
						var next = req.session.returnTo;
						delete req.session.returnTo;
						res.redirect(nconf.get('relative_path') + next);
					}
				});
			})(req, res, next);
		};

		if(meta.config.allowLocalLogin !== undefined && parseInt(meta.config.allowLocalLogin, 10) === 0) {
			return res.send(404);
		}

		if (req.body.username && utils.isEmailValid(req.body.username)) {
			user.getUsernameByEmail(req.body.username, function(err, username) {
				if (err) {
					return next(err);
				}
				req.body.username = username ? username : req.body.username;
				continueLogin();
			});
		} else {
			continueLogin();
		}
	}

	function register(req, res) {
		if(meta.config.allowRegistration !== undefined && parseInt(meta.config.allowRegistration, 10) === 0) {
			return res.send(403);
		}

		var userData = {};

		for (var key in req.body) {
			if (req.body.hasOwnProperty(key)) {
				userData[key] = req.body[key];
			}
		}

		plugins.fireHook('filter:register.check', req, res, userData, function(err, req, res, userData) {
			if (err) {
				return res.redirect(nconf.get('relative_path') + '/register' + (err.message ? '?error=' + err.message : ''));
			}

			user.create(userData, function(err, uid) {
				if (err || !uid) {
					return res.redirect(nconf.get('relative_path') + '/register');
				}

				req.login({
					uid: uid
				}, function() {
					user.logIP(uid, req.ip);

					require('../socket.io').emitUserCount();

					user.notifications.sendWelcomeNotification(uid);

					plugins.fireHook('filter:register.complete', uid, req.body.referrer, function(err, uid, destination) {
						if (destination) {
							res.redirect(nconf.get('relative_path') + destination);
						} else {
							res.redirect(nconf.get('relative_path') + '/');
						}
					});
				});
			});
		});
	}

	Auth.initialize = function(app, middleware) {
		app.use(passport.initialize());
		app.use(passport.session());

		Auth.app = app;
		Auth.middleware = middleware;
	};

	Auth.get_login_strategies = function() {
		return login_strategies;
	};

	Auth.reloadRoutes = function(callback) {
		var router = express.Router();
			router.hotswapId = 'auth';

		plugins.ready(function() {
			// Reset the registered login strategies
			login_strategies.length = 0;

			plugins.fireHook('filter:auth.init', login_strategies, function(err) {
				if (err) {
					winston.error('filter:auth.init - plugin failure');
				}

				var deprecList = [];
				for (var i in login_strategies) {
					if (login_strategies.hasOwnProperty(i)) {
						var strategy = login_strategies[i];

						/*
							Backwards compatibility block for v0.6.0
							Remove this upon release of v0.6.0-1
							Ref: nodebb/nodebb#1849
						*/
						if (strategy.icon.slice(0, 3) !== 'fa-') {
							deprecList.push(strategy.name);
							strategy.icon = 'fa-' + strategy.icon + '-square';
						}
						/* End backwards compatibility block */

						if (strategy.url) {
							router.get(strategy.url, passport.authenticate(strategy.name, {
								scope: strategy.scope
							}));
						}

						router.get(strategy.callbackURL, passport.authenticate(strategy.name, {
							successReturnToOrRedirect: nconf.get('relative_path') + '/',
							failureRedirect: nconf.get('relative_path') + '/login'
						}));
					}
				}

				/*
					Backwards compatibility block for v0.6.0
					Remove this upon release of v0.6.0-1
					Ref: nodebb/nodebb#1849
				*/
				if (deprecList.length) {
					winston.warn('[plugins] Deprecation notice: SSO plugins should now pass in the full fontawesome icon name (e.g. "fa-facebook-o"). Please update the following plugins:');
					for(var x=0,numDeprec=deprecList.length;x<numDeprec;x++) {
						process.stdout.write('  * ' + deprecList[x] + '\n');
					}
				}
				/* End backwards compatibility block */

				router.post('/logout', logout);
				router.post('/register', Auth.middleware.applyCSRF, register);
				router.post('/login', Auth.middleware.applyCSRF, login);

				hotswap.replace('auth', router);
				if (typeof callback === 'function') {
					callback();
				}
			});
		});
	};

	Auth.login = function(username, password, next) {
		if (!username || !password) {
			next(new Error('[[error:invalid-password]]'));
			return;
		}

		var userslug = utils.slugify(username);

		user.getUidByUserslug(userslug, function(err, uid) {
			if (err) {
				return next(err);
			}

			if(!uid) {
				return next(null, false, '[[error:no-user]]');
			}

			user.auth.logAttempt(uid, function(err) {
				if (err) {
					return next(null, false, err.message);
				}

				db.getObjectFields('user:' + uid, ['password', 'banned'], function(err, userData) {
					if (err) {
						return next(err);
					}

					if (!userData || !userData.password) {
						return next(new Error('[[error:invalid-user-data]]'));
					}

					if (userData.banned && parseInt(userData.banned, 10) === 1) {
						return next(null, false, '[[error:user-banned]]');
					}

					Password.compare(password, userData.password, function(err, res) {
						if (err) {
							return next(new Error('bcrypt compare error'));
						}

						if (!res) {
							return next(null, false, '[[error:invalid-password]]');
						}

						user.auth.clearLoginAttempts(uid);

						next(null, {
							uid: uid
						}, '[[success:authentication-successful]]');
					});
				});
			});
		});
	};

	passport.use(new passportLocal(Auth.login));

	passport.serializeUser(function(user, done) {
		done(null, user.uid);
	});

	passport.deserializeUser(function(uid, done) {
		done(null, {
			uid: uid
		});
	});
}(exports));
