'use strict';

const util = require('util');

const user = require('../user');
const plugins = require('../plugins');
const helpers = require('./helpers');

const controllers = {
	api: require('../controllers/api'),
};

const middleware = module.exports;

middleware.buildHeader = helpers.try(async (req, res, next) => {
	res.locals.renderHeader = true;
	res.locals.isAPI = false;
	if (req.method === 'GET') {
		await require('./index').applyCSRFasync(req, res);
	}

	await plugins.hooks.fire('filter:middleware.buildHeader', { req: req, locals: res.locals });
	const [config, canLoginIfBanned] = await Promise.all([
		controllers.api.loadConfig(req),
		user.bans.canLoginIfBanned(req.uid),
	]);

	if (!canLoginIfBanned && req.loggedIn) {
		req.logout(() => {
			res.redirect('/');
		});
		return;
	}

	res.locals.config = config;
	next();
});

middleware.buildHeaderAsync = util.promisify(middleware.buildHeader);
