'use strict';

const nconf = require('nconf');
const winston = require('winston');
const passport = require('passport');
const util = require('util');

const meta = require('../meta');
const user = require('../user');
const privileges = require('../privileges');
const plugins = require('../plugins');
const helpers = require('./helpers');
const auth = require('../routes/authentication');

const controllers = {
	helpers: require('../controllers/helpers'),
	authentication: require('../controllers/authentication'),
};

const passportAuthenticateAsync = function (req, res) {
	return new Promise((resolve, reject) => {
		passport.authenticate('core.api', { session: false }, (err, user) => {
			if (err) {
				reject(err);
			} else {
				resolve(user);
			}
		})(req, res);
	});
};

module.exports = function (middleware) {
	async function authenticate(req, res) {
		const loginAsync = util.promisify(req.login).bind(req);

		if (req.loggedIn) {
			// If authenticated via cookie (express-session), protect routes with CSRF checking
			if (res.locals.isAPI) {
				await middleware.applyCSRFasync(req, res);
			}

			return true;
		} else if (req.headers.hasOwnProperty('authorization')) {
			const user = await passportAuthenticateAsync(req, res);
			if (!user) { return true; }

			// If the token received was a master token, a _uid must also be present for all calls
			if (user.hasOwnProperty('uid')) {
				await loginAsync(user);
				await controllers.authentication.onSuccessfulLogin(req, user.uid);
				req.uid = user.uid;
				req.loggedIn = req.uid > 0;
				return true;
			} else if (user.hasOwnProperty('master') && user.master === true) {
				if (req.body.hasOwnProperty('_uid') || req.query.hasOwnProperty('_uid')) {
					user.uid = req.body._uid || req.query._uid;
					delete user.master;

					await loginAsync(user);
					await controllers.authentication.onSuccessfulLogin(req, user.uid);
					req.uid = user.uid;
					req.loggedIn = req.uid > 0;
					return true;
				}

				throw new Error('A master token was received without a corresponding `_uid` in the request body');
			} else {
				winston.warn('[api/authenticate] Unable to find user after verifying token');
				return true;
			}
		}

		await plugins.hooks.fire('response:middleware.authenticate', {
			req: req,
			res: res,
			next: function () {},	// no-op for backwards compatibility
		});

		if (!res.headersSent) {
			auth.setAuthVars(req);
		}
		return !res.headersSent;
	}

	middleware.authenticate = helpers.try(async (req, res, next) => {
		winston.warn(`[middleware] middleware.authenticate has been deprecated, page and API routes are now automatically authenticated via setup(Page|API)Route. Use middleware.authenticateRequest (if not using route helper) and middleware.ensureLoggedIn instead. (request path: ${req.path})`);
		if (!await authenticate(req, res)) {
			return;
		}
		if (!req.loggedIn) {
			return controllers.helpers.notAllowed(req, res);
		}
		next();
	});

	middleware.authenticateRequest = helpers.try(async (req, res, next) => {
		if (!await authenticate(req, res)) {
			return;
		}
		next();
	});

	middleware.ensureSelfOrGlobalPrivilege = helpers.try(async (req, res, next) => {
		await ensureSelfOrMethod(user.isAdminOrGlobalMod, req, res, next);
	});

	middleware.ensureSelfOrPrivileged = helpers.try(async (req, res, next) => {
		await ensureSelfOrMethod(user.isPrivileged, req, res, next);
	});

	async function ensureSelfOrMethod(method, req, res, next) {
		/*
			The "self" part of this middleware hinges on you having used
			middleware.exposeUid prior to invoking this middleware.
		*/
		if (!req.loggedIn) {
			return controllers.helpers.notAllowed(req, res);
		}
		if (req.uid === parseInt(res.locals.uid, 10)) {
			return next();
		}
		const allowed = await method(req.uid);
		if (!allowed) {
			return controllers.helpers.notAllowed(req, res);
		}

		return next();
	}

	middleware.canViewUsers = helpers.try(async (req, res, next) => {
		if (parseInt(res.locals.uid, 10) === req.uid) {
			return next();
		}
		const canView = await privileges.global.can('view:users', req.uid);
		if (canView) {
			return next();
		}
		controllers.helpers.notAllowed(req, res);
	});

	middleware.canViewGroups = helpers.try(async (req, res, next) => {
		const canView = await privileges.global.can('view:groups', req.uid);
		if (canView) {
			return next();
		}
		controllers.helpers.notAllowed(req, res);
	});

	middleware.checkAccountPermissions = helpers.try(async (req, res, next) => {
		// This middleware ensures that only the requested user and admins can pass
		if (!await authenticate(req, res)) {
			return;
		}
		if (!req.loggedIn) {
			return controllers.helpers.notAllowed(req, res);
		}
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
	});

	middleware.redirectToAccountIfLoggedIn = helpers.try(async (req, res, next) => {
		if (req.session.forceLogin || req.uid <= 0) {
			return next();
		}
		const userslug = await user.getUserField(req.uid, 'userslug');
		controllers.helpers.redirect(res, `/user/${userslug}`);
	});

	middleware.redirectUidToUserslug = helpers.try(async (req, res, next) => {
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
			.replace(uid, () => userslug);
		controllers.helpers.redirect(res, path);
	});

	middleware.redirectMeToUserslug = helpers.try(async (req, res) => {
		const userslug = await user.getUserField(req.uid, 'userslug');
		if (!userslug) {
			return controllers.helpers.notAllowed(req, res);
		}
		const path = req.path.replace(/^(\/api)?\/me/, `/user/${userslug}`);
		controllers.helpers.redirect(res, path);
	});

	middleware.isAdmin = helpers.try(async (req, res, next) => {
		// TODO: Remove in v1.16.0
		winston.warn('[middleware] middleware.isAdmin deprecated, use middleware.admin.checkPrivileges instead');

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
			returnTo = req.path.replace(new RegExp(`^${nconf.get('relative_path')}`), '');
		}
		returnTo = returnTo.replace(/^\/api/, '');

		req.session.returnTo = returnTo;
		req.session.forceLogin = 1;
		if (res.locals.isAPI) {
			controllers.helpers.formatApiResponse(401, res);
		} else {
			res.redirect(`${nconf.get('relative_path')}/login?local=1`);
		}
	});

	middleware.requireUser = function (req, res, next) {
		if (req.loggedIn) {
			return next();
		}

		res.status(403).render('403', { title: '[[global:403.title]]' });
	};

	middleware.registrationComplete = async function registrationComplete(req, res, next) {
		// If the user's session contains registration data, redirect the user to complete registration
		if (!req.session.hasOwnProperty('registration')) {
			return setImmediate(next);
		}

		const path = req.path.startsWith('/api/') ? req.path.replace('/api', '') : req.path;
		const { allowed } = await plugins.hooks.fire('filter:middleware.registrationComplete', {
			allowed: ['/register/complete'],
		});
		if (!allowed.includes(path)) {
			// Append user data if present
			req.session.registration.uid = req.uid;

			controllers.helpers.redirect(res, '/register/complete');
		} else {
			setImmediate(next);
		}
	};
};
