'use strict';

const helpers = require('../helpers');

const homePageController = module.exports;

homePageController.get = async function (req, res) {
	const routes = await helpers.getHomePageRoutes(req.uid);
	res.render('admin/general/homepage', { routes: routes });
};
