'use strict';

var async = require('async');
var nconf =  require('nconf');
var meta = require('../meta');
var user = require('../user');

var controllers = {
	helpers: require('../controllers/helpers')
};

module.exports = function (middleware) {

	middleware.checkGlobalPrivacySettings = function (req, res, next) {
		if (!req.user && !!parseInt(meta.config.privateUserInfo, 10)) {
			return controllers.helpers.notAllowed(req, res);
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
				if (parseInt(uid, 10) === req.uid) {
					return next(null, true);
				}

				user.isAdminOrGlobalMod(req.uid, next);
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
			}
		], function (err, allowed) {
			if (err || allowed) {
				return next(err);
			}
			controllers.helpers.notAllowed(req, res);
		});
	};

	middleware.redirectToAccountIfLoggedIn = function (req, res, next) {
		if (req.session.forceLogin) {
			return next();
		}

		if (!req.user) {
			return next();
		}
		user.getUserField(req.user.uid, 'userslug', function (err, userslug) {
			if (err) {
				return next(err);
			}
			controllers.helpers.redirect(res, '/user/' + userslug);
		});
	};

	middleware.redirectUidToUserslug = function (req, res, next) {
		var uid = parseInt(req.params.uid, 10);
		if (!uid) {
			return next();
		}
		user.getUserField(uid, 'userslug', function (err, userslug) {
			if (err || !userslug) {
				return next(err);
			}

			var path = req.path.replace(/^\/api/, '')
					.replace('uid', 'user')
					.replace(uid, function () { return userslug; });
			controllers.helpers.redirect(res, path);
		});
	};

	middleware.isAdmin = function (req, res, next) {
		if (!req.uid) {
			return controllers.helpers.notAllowed(req, res);
		}

		user.isAdministrator(req.uid, function (err, isAdmin) {
			if (err) {
				return next(err);
			}

			if (isAdmin) {
				user.hasPassword(req.uid, function (err, hasPassword) {
					if (err) {
						return next(err);
					}

					if (!hasPassword) {
						return next();
					}

					var loginTime = req.session.meta ? req.session.meta.datetime : 0;
					if (loginTime && parseInt(loginTime, 10) > Date.now() - 3600000) {
						var timeLeft = parseInt(loginTime, 10) - (Date.now() - 3600000);
						if (timeLeft < 300000) {
							req.session.meta.datetime += 300000;
						}

						return next();
					}

					req.session.returnTo = req.path.replace(/^\/api/, '');
					req.session.forceLogin = 1;
					if (res.locals.isAPI) {
						res.status(401).json({});
					} else {
						res.redirect(nconf.get('relative_path') + '/login');
					}
				});
				return;
			}

			if (res.locals.isAPI) {
				return controllers.helpers.notAllowed(req, res);
			}

			middleware.buildHeader(req, res, function () {
				controllers.helpers.notAllowed(req, res);
			});
		});
	};

	middleware.requireUser = function (req, res, next) {
		if (req.user) {
			return next();
		}

		res.status(403).render('403', {title: '[[global:403.title]]'});
	};

	middleware.registrationComplete = function (req, res, next) {
		// If the user's session contains registration data, redirect the user to complete registration
		if (!req.session.hasOwnProperty('registration')) {
			return next();
		} else {
			if (!req.path.endsWith('/register/complete')) {
				controllers.helpers.redirect(res, '/register/complete');
			} else {
				return next();
			}
		}
	};

};



