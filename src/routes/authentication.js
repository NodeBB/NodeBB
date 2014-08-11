(function(Auth) {
	"use strict";

	var passport = require('passport'),
		passportLocal = require('passport-local').Strategy,
		nconf = require('nconf'),
		bcrypt = require('bcryptjs'),
		winston = require('winston'),
		async = require('async'),

		meta = require('./../meta'),
		user = require('./../user'),
		plugins = require('./../plugins'),
		db = require('../database'),
		utils = require('./../../public/src/utils'),

		login_strategies = [];

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
					return res.json(403, err.message);
				}

				if (!userData) {
					return res.json(403, info);
				}

				// Alter user cookie depending on passed-in option
				if (req.body.remember === 'true') {
					var duration = 1000*60*60*24*parseInt(meta.configs.loginDays || 14, 10);
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
					}

					res.json(200, info);
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

	Auth.initialize = function(app) {
		app.use(passport.initialize());
		app.use(passport.session());
	};


	Auth.get_login_strategies = function() {
		return login_strategies;
	};

	Auth.registerApp = function(app) {
		Auth.app = app;
	};

	Auth.createRoutes = function(app, middleware, controllers) {
		plugins.ready(function() {
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
							app.get(strategy.url, passport.authenticate(strategy.name, {
								scope: strategy.scope
							}));
						}

						app.get(strategy.callbackURL, passport.authenticate(strategy.name, {
							successRedirect: nconf.get('relative_path') + '/',
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

				app.post('/logout', logout);
				app.post('/register', register);
				app.post('/login', login);
			});
		});
	};

	Auth.login = function(username, password, next) {
		if (!username || !password) {
			return next(new Error('[[error:invalid-user-data]]'));
		}

		var userslug = utils.slugify(username);

		user.getUidByUserslug(userslug, function(err, uid) {
			if (err) {
				return next(err);
			}

			if(!uid) {
				// To-do: Even if a user doesn't exist, compare passwords anyway, so we don't immediately return
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

					bcrypt.compare(password, userData.password, function(err, res) {
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
