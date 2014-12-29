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

		loginStrategies = [];

	Auth.initialize = function(app, middleware) {
		app.use(passport.initialize());
		app.use(passport.session());

		Auth.app = app;
		Auth.middleware = middleware;
	};

	Auth.getLoginStrategies = function() {
		return loginStrategies;
	};

	Auth.reloadRoutes = function(callback) {
		var router = express.Router();
		router.hotswapId = 'auth';

		plugins.ready(function() {
			loginStrategies.length = 0;

			plugins.fireHook('filter:auth.init', loginStrategies, function(err) {
				if (err) {
					winston.error('filter:auth.init - plugin failure');
					return callback(err);
				}

				loginStrategies.forEach(function(strategy) {
					if (strategy.url) {
						router.get(strategy.url, passport.authenticate(strategy.name, {
							scope: strategy.scope
						}));
					}

					router.get(strategy.callbackURL, passport.authenticate(strategy.name, {
						successReturnToOrRedirect: nconf.get('relative_path') + '/',
						failureRedirect: nconf.get('relative_path') + '/login'
					}));
				});

				router.post('/logout', Auth.middleware.applyCSRF, logout);
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
			return next(new Error('[[error:invalid-password]]'));
		}

		var userslug = utils.slugify(username);
		var uid;

		async.waterfall([
			function(next) {
				user.getUidByUserslug(userslug, next);
			},
			function(_uid, next) {
				if (!_uid) {
					return next(new Error('[[error:no-user]]'));
				}
				uid = _uid;
				user.auth.logAttempt(uid, next);
			},
			function(next) {
				db.getObjectFields('user:' + uid, ['password', 'banned'], next);
			},
			function(userData, next) {
				if (!userData || !userData.password) {
					return next(new Error('[[error:invalid-user-data]]'));
				}
				if (userData.banned && parseInt(userData.banned, 10) === 1) {
					return next(new Error('[[error:user-banned]]'));
				}
				Password.compare(password, userData.password, next);
			},
			function(passwordMatch, next) {
				if (!passwordMatch) {
					return next(new Error('[[error:invalid-password]]'));
				}
				user.auth.clearLoginAttempts(uid);
				next(null, {uid: uid}, '[[success:authentication-successful]]');
			}
		], next);
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

	function login(req, res, next) {
		if (parseInt(meta.config.allowLocalLogin, 10) === 0) {
			return res.status(404).send('');
		}

		// Handle returnTo data
		if (req.body.hasOwnProperty('returnTo') && !req.session.returnTo) {
			req.session.returnTo = req.body.returnTo;
		}

		if (req.body.username && utils.isEmailValid(req.body.username)) {
			user.getUsernameByEmail(req.body.username, function(err, username) {
				if (err) {
					return next(err);
				}
				req.body.username = username ? username : req.body.username;
				continueLogin(req, res, next);
			});
		} else {
			continueLogin(req, res, next);
		}
	}

	function continueLogin(req, res, next) {
		passport.authenticate('local', function(err, userData, info) {
			if (err) {
				return res.status(403).send(err.message);
			}

			if (!userData) {
				if (typeof info === 'object') {
					info = '[[error:invalid-username-or-password]]';
				}

				return res.status(403).send(info);
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
			}, function(err) {
				if (err) {
					return res.status(403).send(err.message);
				}
				if (userData.uid) {
					user.logIP(userData.uid, req.ip);

					plugins.fireHook('action:user.loggedIn', userData.uid);
				}

				if (!req.session.returnTo) {
					res.status(200).send(nconf.get('relative_path') + '/');
				} else {

					var next = req.session.returnTo;
					delete req.session.returnTo;

					res.status(200).send(next);
				}
			});
		})(req, res, next);
	}

	function register(req, res) {
		if (parseInt(meta.config.allowRegistration, 10) === 0) {
			return res.sendStatus(403);
		}

		var userData = {};

		for (var key in req.body) {
			if (req.body.hasOwnProperty(key)) {
				userData[key] = req.body[key];
			}
		}

		var uid;
		async.waterfall([
			function(next) {
				if (!userData.email) {
					return next(new Error('[[error:invalid-email]]'));
				}

				if (!userData.username || userData.username.length < meta.config.minimumUsernameLength) {
					return next(new Error('[[error:username-too-short]]'));
				}

				if (userData.username.length > meta.config.maximumUsernameLength) {
					return next(new Error('[[error:username-too-long'));
				}

				if (!userData.password || userData.password.length < meta.config.minimumPasswordLength) {
					return next(new Error('[[user:change_password_error_length]]'));
				}

				next();
			},
			function(next) {
				plugins.fireHook('filter:register.check', {req: req, res: res, userData: userData}, next);
			},
			function(data, next) {
				user.create(data.userData, next);
			},
			function(_uid, next) {
				uid = _uid;
				req.login({uid: uid}, next);
			},
			function(next) {
				user.logIP(uid, req.ip);

				user.notifications.sendWelcomeNotification(uid);

				plugins.fireHook('filter:register.complete', {uid: uid, referrer: req.body.referrer}, next);
			}
		], function(err, data) {
			if (err) {
				return res.status(400).send(err.message);
			}

			res.status(200).send(data.referrer ? data.referrer : nconf.get('relative_path') + '/');
		});
	}

	function logout(req, res, next) {
		if (req.user && parseInt(req.user.uid, 10) > 0 && req.sessionID) {

			require('../socket.io').logoutUser(req.user.uid);
			db.sessionStore.destroy(req.sessionID, function(err) {
				if (err) {
					return next(err);
				}
				req.logout();
				res.status(200).send('');
			});
		} else {
			res.status(200).send('');
		}
	}

}(exports));
