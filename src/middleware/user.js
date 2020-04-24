'use strict';

const util = require('util');
const nconf = require('nconf');
const winston = require('winston');

const meta = require('../meta');
const user = require('../user');
const privileges = require('../privileges');
const plugins = require('../plugins');

const auth = require('../routes/authentication');

const controllers = {
	helpers: require('../controllers/helpers'),
};

module.exports = function (middleware) {
	async function authenticate(req, res, next, callback) {
		if (req.loggedIn) {
			return next();
		}

		await plugins.fireHook('response:middleware.authenticate', {
			req: req,
			res: res,
			next: function () {},	// no-op for backwards compatibility
		});

		if (!res.headersSent) {
			auth.setAuthVars(req, res, function () {
				if (req.loggedIn && req.user && req.user.uid) {
					return next();
				}

				callback();
			});
		}
	}

	middleware.authenticate = function middlewareAuthenticate(req, res, next) {
		authenticate(req, res, next, function () {
			controllers.helpers.notAllowed(req, res, next);
		});
	};

	const authenticateAsync = util.promisify(middleware.authenticate);

	middleware.authenticateOrGuest = function authenticateOrGuest(req, res, next) {
		authenticate(req, res, next, next);
	};

	middleware.ensureSelfOrGlobalPrivilege = function ensureSelfOrGlobalPrivilege(req, res, next) {
		ensureSelfOrMethod(user.isAdminOrGlobalMod, req, res, next);
	};

	middleware.ensureSelfOrPrivileged = function ensureSelfOrPrivileged(req, res, next) {
		ensureSelfOrMethod(user.isPrivileged, req, res, next);
	};

	async function ensureSelfOrMethod(method, req, res, next) {
		/*
			The "self" part of this middleware hinges on you having used
			middleware.exposeUid prior to invoking this middleware.
		*/
		if (!req.loggedIn) {
			return controllers.helpers.notAllowed(req, res);
		}
		if (req.uid === parseInt(res.locals.uid, 10)) {
			return setImmediate(next);
		}
		const allowed = await method(req.uid);
		if (!allowed) {
			return controllers.helpers.notAllowed(req, res);
		}

		return next();
	}

	middleware.checkGlobalPrivacySettings = function checkGlobalPrivacySettings(req, res, next) {
		winston.warn('[middleware], checkGlobalPrivacySettings deprecated, use canViewUsers or canViewGroups');
		middleware.canViewUsers(req, res, next);
	};

	middleware.canViewUsers = async function canViewUsers(req, res, next) {
		if (parseInt(res.locals.uid, 10) === req.uid) {
			return next();
		}
		const canView = await privileges.global.can('view:users', req.uid);
		if (canView) {
			return next();
		}
		controllers.helpers.notAllowed(req, res);
	};

	middleware.canViewGroups = async function canViewGroups(req, res, next) {
		const canView = await privileges.global.can('view:groups', req.uid);
		if (canView) {
			return next();
		}
		controllers.helpers.notAllowed(req, res);
	};

	middleware.checkAccountPermissions = async function checkAccountPermissions(req, res, next) {
		// This middleware ensures that only the requested user and admins can pass
		await authenticateAsync(req, res);
		const uid = await user.getUidByUserslug(req.params.userslug);
		let allowed = await privileges.users.canEdit(req.uid, uid);
		if (allowed) {
			return next();
		}

		if (/user\/.+\/info$/.test(req.path)) {
			allowed = await privileges.global.can('view:users:info', req.uid);
		}
		if (allowed) {
			return next();
		}
		controllers.helpers.notAllowed(req, res);
	};

	middleware.redirectToAccountIfLoggedIn = async function redirectToAccountIfLoggedIn(req, res, next) {
		if (req.session.forceLogin || req.uid <= 0) {
			return next();
		}
		const userslug = await user.getUserField(req.uid, 'userslug');
		controllers.helpers.redirect(res, '/user/' + userslug);
	};

	middleware.redirectUidToUserslug = async function redirectUidToUserslug(req, res, next) {
		const uid = parseInt(req.params.uid, 10);
		if (uid <= 0) {
			return next();
		}
		const userslug = await user.getUserField(uid, 'userslug');
		if (!userslug) {
			return next();
		}
		const path = req.path.replace(/^\/api/, '')
			.replace('uid', 'user')
			.replace(uid, function () { return userslug; });
		controllers.helpers.redirect(res, path);
	};

	middleware.redirectMeToUserslug = async function redirectMeToUserslug(req, res) {
		const userslug = await user.getUserField(req.uid, 'userslug');
		if (!userslug) {
			return controllers.helpers.notAllowed(req, res);
		}
		const path = req.path.replace(/^(\/api)?\/me/, '/user/' + userslug);
		controllers.helpers.redirect(res, path);
	};

	middleware.isAdmin = async function isAdmin(req, res, next) {
		const isAdmin = await user.isAdministrator(req.uid);
		if (!isAdmin) {
			return controllers.helpers.notAllowed(req, res);
		}
		const hasPassword = await user.hasPassword(req.uid);
		if (!hasPassword) {
			return next();
		}

		const loginTime = req.session.meta ? req.session.meta.datetime : 0;
		const adminReloginDuration = meta.config.adminReloginDuration * 60000;
		const disabled = meta.config.adminReloginDuration === 0;
		if (disabled || (loginTime && parseInt(loginTime, 10) > Date.now() - adminReloginDuration)) {
			const timeLeft = parseInt(loginTime, 10) - (Date.now() - adminReloginDuration);
			if (req.session.meta && timeLeft < Math.min(300000, adminReloginDuration)) {
				req.session.meta.datetime += Math.min(300000, adminReloginDuration);
			}

			return next();
		}

		let returnTo = req.path;
		if (nconf.get('relative_path')) {
			returnTo = req.path.replace(new RegExp('^' + nconf.get('relative_path')), '');
		}
		returnTo = returnTo.replace(/^\/api/, '');

		req.session.returnTo = returnTo;
		req.session.forceLogin = 1;
		if (res.locals.isAPI) {
			res.status(401).json({});
		} else {
			res.redirect(nconf.get('relative_path') + '/login?local=1');
		}
	};

	middleware.requireUser = function (req, res, next) {
		if (req.loggedIn) {
			return next();
		}

		res.status(403).render('403', { title: '[[global:403.title]]' });
	};

	middleware.registrationComplete = function registrationComplete(req, res, next) {
		// If the user's session contains registration data, redirect the user to complete registration
		if (!req.session.hasOwnProperty('registration')) {
			return setImmediate(next);
		}
		if (!req.path.endsWith('/register/complete')) {
			// Append user data if present
			req.session.registration.uid = req.uid;

			controllers.helpers.redirect(res, '/register/complete');
		} else {
			setImmediate(next);
		}
	};
};
