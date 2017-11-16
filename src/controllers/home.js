'use strict';

var plugins = require('../plugins');
var meta = require('../meta');
var user = require('../user');
var pubsub = require('../pubsub');

var adminHomePageRoute;
var getRoute;

function configUpdated() {
	adminHomePageRoute = (meta.config.homePageRoute || meta.config.homePageCustom || '').replace(/^\/+/, '') || 'categories';
	getRoute = parseInt(meta.config.allowUserHomePage, 10) ? getRouteAllowUserHomePage : getRouteDisableUserHomePage;
}

function getRouteDisableUserHomePage(uid, next) {
	next(null, adminHomePageRoute);
}

function getRouteAllowUserHomePage(uid, next) {
	user.getSettings(uid, function (err, settings) {
		if (err) {
			return next(err);
		}

		var route = adminHomePageRoute;

		if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
			route = settings.homePageRoute || route;
		}

		next(null, route);
	});
}

pubsub.on('config:update', configUpdated);
configUpdated();

module.exports = function (req, res, next) {
	if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
		return next();
	}

	getRoute(req.uid, function (err, route) {
		if (err) {
			return next(err);
		}

		var hook = 'action:homepage.get:' + route;

		if (plugins.hasListeners(hook)) {
			return plugins.fireHook(hook, {
				req: req,
				res: res,
				next: next,
			});
		}

		req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + route;
		next();
	});
};
