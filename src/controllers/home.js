'use strict';

var async = require('async');
var plugins = require('../plugins');
var meta = require('../meta');
var user = require('../user');

function adminHomePageRoute() {
	return (meta.config.homePageRoute || meta.config.homePageCustom || '').replace(/^\/+/, '') || 'categories';
}

function getUserHomeRoute(uid, callback) {
	async.waterfall([
		function (next) {
			user.getSettings(uid, next);
		},
		function (settings, next) {
			var route = adminHomePageRoute();

			if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
				route = settings.homePageRoute || route;
			}

			next(null, route);
		},
	], callback);
}

function rewrite(req, res, next) {
	if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
		return next();
	}

	async.waterfall([
		function (next) {
			if (parseInt(meta.config.allowUserHomePage, 10)) {
				getUserHomeRoute(req.uid, next);
			} else {
				next(null, adminHomePageRoute());
			}
		},
		function (route, next) {
			var hook = 'action:homepage.get:' + route;

			if (!plugins.hasListeners(hook)) {
				req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + route;
			} else {
				res.locals.homePageRoute = route;
			}

			next();
		},
	], next);
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
