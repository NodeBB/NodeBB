'use strict';


const nconf = require('nconf');

const user = require('../user');
const meta = require('../meta');
const plugins = require('../plugins');
const privileges = require('../privileges');
const helpers = require('./helpers');

const controllers = {
	admin: require('../controllers/admin'),
	helpers: require('../controllers/helpers'),
};

const middleware = module.exports;

middleware.buildHeader = helpers.try(async (req, res, next) => {
	res.locals.renderAdminHeader = true;
	if (req.method === 'GET') {
		await require('./index').applyCSRFasync(req, res);
	}

	res.locals.config = await controllers.admin.loadConfig(req);
	next();
});

middleware.checkPrivileges = helpers.try(async (req, res, next) => {
	// Kick out guests, obviously
	if (req.uid <= 0) {
		return controllers.helpers.notAllowed(req, res);
	}

	// Otherwise, check for privilege based on page (if not in mapping, deny access)
	const path = req.path.replace(/^(\/api)?(\/v3)?\/admin\/?/g, '');
	if (path) {
		const privilege = privileges.admin.resolve(path);
		if (!await privileges.admin.can(privilege, req.uid)) {
			return controllers.helpers.notAllowed(req, res);
		}
	} else {
		// If accessing /admin, check for any valid admin privs
		const privilegeSet = await privileges.admin.get(req.uid);
		if (!Object.values(privilegeSet).some(Boolean)) {
			return controllers.helpers.notAllowed(req, res);
		}
	}

	// If user does not have password
	const hasPassword = await user.hasPassword(req.uid);
	if (!hasPassword) {
		return next();
	}

	// Reject if they need to re-login (due to ACP timeout), otherwise extend logout timer
	const loginTime = req.session.meta ? req.session.meta.datetime : 0;
	const adminReloginDuration = meta.config.adminReloginDuration * 60000;
	const disabled = meta.config.adminReloginDuration === 0;
	if (disabled || (loginTime && parseInt(loginTime, 10) > Date.now() - adminReloginDuration)) {
		const timeLeft = parseInt(loginTime, 10) - (Date.now() - adminReloginDuration);
		if (req.session.meta && timeLeft < Math.min(60000, adminReloginDuration)) {
			req.session.meta.datetime += Math.min(60000, adminReloginDuration);
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

	await plugins.hooks.fire('response:auth.relogin', { req, res });
	if (res.headersSent) {
		return;
	}

	if (res.locals.isAPI) {
		controllers.helpers.formatApiResponse(401, res);
	} else {
		res.redirect(`${nconf.get('relative_path')}/login?local=1`);
	}
});
