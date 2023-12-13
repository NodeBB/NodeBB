'use strict';

const plugins = require('../plugins');
const helpers = require('./helpers');

const controllers = {
	api: require('../controllers/api'),
};

const middleware = module.exports;

middleware.buildHeader = helpers.try(async (req, res, next) => {
	await doBuildHeader(req, res);
	next();
});

middleware.buildHeaderAsync = async (req, res) => {
	await doBuildHeader(req, res);
};

async function doBuildHeader(req, res) {
	res.locals.renderHeader = true;
	res.locals.isAPI = false;
	if (req.method === 'GET') {
		await require('./index').applyCSRFasync(req, res);
	}

	await plugins.hooks.fire('filter:middleware.buildHeader', { req: req, locals: res.locals });
	res.locals.config = await controllers.api.loadConfig(req);
}
