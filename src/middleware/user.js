'use strict';

var async = require('async');
var nconf = require('nconf');

var meta = require('../meta');
var user = require('../user');
var privileges = require('../privileges');
var plugins = require('../plugins');

var auth = require('../routes/authentication');

var controllers = {
	helpers: require('../controllers/helpers'),
};

module.exports = function (middleware) {
	function authenticate(req, res, next, callback) {
		if (req.loggedIn) {
			return next();
		}

		if (plugins.hasListeners('action:middleware.authenticate')) {
			return plugins.fireHook('action:middleware.authenticate', {
				req: req,
				res: res,
				next: function (err) {
					if (err) {
						return next(err);
					}

					auth.setAuthVars(req, res, function () {
						if (req.loggedIn && req.user && req.user.uid) {
							return next();
						}

						callback();
					});
				},
			});
		}

		callback();
	}

	middleware.authenticate = function (req, res, next) {
		authenticate(req, res, next, function () {
			controllers.helpers.notAllowed(req, res, next);
		});
	};

	middleware.authenticateOrGuest = function (req, res, next) {
		authenticate(req, res, next, next);
	};

	middleware.ensureSelfOrGlobalPrivilege = function (req, res, next) {
		ensureSelfOrMethod(user.isAdminOrGlobalMod, req, res, next);
	};

	middleware.ensureSelfOrPrivileged = function (req, res, next) {
		ensureSelfOrMethod(user.isPrivileged, req, res, next);
	};

	function ensureSelfOrMethod(method, req, res, next) {
		/*
			The "self" part of this middleware hinges on you having used
			middleware.exposeUid prior to invoking this middleware.
		*/
		async.waterfall([
			function (next) {
				if (!req.loggedIn) {
					return setImmediate(next, null, false);
				}

				if (req.uid === parseInt(res.locals.uid, 10)) {
					return setImmediate(next, null, true);
				}

				method(req.uid, next);
			},
			function (allowed, next) {
				if (!allowed) {
					return controllers.helpers.notAllowed(req, res);
				}
				next();
			},
		], next);
	}

	middleware.checkGlobalPrivacySettings = function (req, res, next) {
		if (!req.loggedIn && meta.config.privateUserInfo) {
			return middleware.authenticate(req, res, next);
		}

		next();
	};

	middleware.checkAccountPermissions = function (req, res, next) {
		// This middleware ensures that only the requested user and admins can pass
		async.waterfall([
			function (next) {
				middleware.authenticate(req, res, next);
			},
			function (next) {
				user.getUidByUserslug(req.params.userslug, next);
			},
			function (uid, next) {
				privileges.users.canEdit(req.uid, uid, next);
			},
			function (allowed, next) {
				if (allowed) {
					return next(null, allowed);
				}

				// For the account/info page only, allow plain moderators through
				if (/user\/.+\/info$/.test(req.path)) {
					user.isModeratorOfAnyCategory(req.uid, next);
				} else {
					next(null, false);
				}
			},
			function (allowed) {
				if (allowed) {
					return next();
				}
				controllers.helpers.notAllowed(req, res);
			},
		], next);
	};

	middleware.redirectToAccountIfLoggedIn = function (req, res, next) {
		if (req.session.forceLogin || !req.uid) {
			return next();
		}

		async.waterfall([
			function (next) {
				user.getUserField(req.uid, 'userslug', next);
			},
			function (userslug) {
				controllers.helpers.redirect(res, '/user/' + userslug);
			},
		], next);
	};

	middleware.redirectUidToUserslug = function (req, res, next) {
		var uid = parseInt(req.params.uid, 10);
		if (uid <= 0) {
			return next();
		}
		async.waterfall([
			function (next) {
				user.getUserField(uid, 'userslug', next);
			},
			function (userslug) {
				if (!userslug) {
					return next();
				}
				var path = req.path.replace(/^\/api/, '')
					.replace('uid', 'user')
					.replace(uid, function () { return userslug; });
				controllers.helpers.redirect(res, path);
			},
		], next);
	};

	middleware.redirectMeToUserslug = function (req, res, next) {
		var uid = req.uid;
		async.waterfall([
			function (next) {
				user.getUserField(uid, 'userslug', next);
			},
			function (userslug) {
				if (!userslug) {
					return controllers.helpers.notAllowed(req, res);
				}
				var path = req.path.replace(/^(\/api)?\/me/, '/user/' + userslug);
				controllers.helpers.redirect(res, path);
			},
		], next);
	};

	middleware.isAdmin = function (req, res, next) {
		async.waterfall([
			function (next) {
				user.isAdministrator(req.uid, next);
			},
			function (isAdmin, next) {
				if (!isAdmin) {
					return controllers.helpers.notAllowed(req, res);
				}
				user.hasPassword(req.uid, next);
			},
			function (hasPassword, next) {
				if (!hasPassword) {
					return next();
				}

				var loginTime = req.session.meta ? req.session.meta.datetime : 0;
				var adminReloginDuration = meta.config.adminReloginDuration * 60000;
				var disabled = meta.config.adminReloginDuration === 0;
				if (disabled || (loginTime && parseInt(loginTime, 10) > Date.now() - adminReloginDuration)) {
					var timeLeft = parseInt(loginTime, 10) - (Date.now() - adminReloginDuration);
					if (req.session.meta && timeLeft < Math.min(300000, adminReloginDuration)) {
						req.session.meta.datetime += Math.min(300000, adminReloginDuration);
					}

					return next();
				}

				var returnTo = req.path;
				if (nconf.get('relative_path')) {
					returnTo = req.path.replace(new RegExp('^' + nconf.get('relative_path')), '');
				}
				returnTo = returnTo.replace(/^\/api/, '');

				req.session.returnTo = nconf.get('relative_path') + returnTo;
				req.session.forceLogin = 1;
				if (res.locals.isAPI) {
					res.status(401).json({});
				} else {
					res.redirect(nconf.get('relative_path') + '/login');
				}
			},
		], next);
	};

	middleware.requireUser = function (req, res, next) {
		if (req.loggedIn) {
			return next();
		}

		res.status(403).render('403', { title: '[[global:403.title]]' });
	};

	middleware.registrationComplete = function (req, res, next) {
		// If the user's session contains registration data, redirect the user to complete registration
		if (!req.session.hasOwnProperty('registration')) {
			return setImmediate(next);
		}
		if (!req.path.endsWith('/register/complete')) {
			// Append user data if present
			req.session.registration.uid = req.uid;

			controllers.helpers.redirect(res, '/register/complete');
		} else {
			return setImmediate(next);
		}
	};
};
