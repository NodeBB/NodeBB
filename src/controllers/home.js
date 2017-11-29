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

function rewrite(req, res, next) {
	if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
		return next();
	}

	getRoute(req.uid, function (err, route) {
		if (err) {
			return next(err);
		}

		var hook = 'action:homepage.get:' + route;

		if (!plugins.hasListeners(hook)) {
			req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + route;
		} else {
			res.locals.homePageRoute = route;
		}

		next();
	});
}

exports.rewrite = rewrite;

function pluginHook(req, res, next) {
	var hook = 'action:homepage.get:' + res.locals.homePageRoute;

	plugins.fireHook(hook, {
		req: req,
		res: res,
		next: next,
	});
}

exports.pluginHook = pluginHook;
