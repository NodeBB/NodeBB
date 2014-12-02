"use strict";

var app,
	middleware = {},
	nconf = require('nconf'),
	async = require('async'),
	path = require('path'),
	winston = require('winston'),
	user = require('../user'),
	meta = require('../meta'),
	plugins = require('../plugins'),

	controllers = {
		api: require('../controllers/api'),
		helpers: require('../controllers/helpers')
	};

middleware.isAdmin = function(req, res, next) {
	winston.warn('[middleware.admin.isAdmin] deprecation warning, no need to use this from plugins!');

	if (!req.user) {
		controllers.helpers.notAllowed(req, res);
	}

	user.isAdministrator((req.user && req.user.uid) ? req.user.uid : 0, function (err, isAdmin) {
		if (err || isAdmin) {
			return next(err);
		}

		controllers.helpers.notAllowed(req, res);
	});
};

middleware.buildHeader = function(req, res, next) {
	var uid = req.user ? req.user.uid : 0;
	async.parallel([
		function(next) {
			var custom_header = {
				'plugins': [],
				'authentication': []
			};

			user.getUserFields(uid, ['username', 'userslug', 'picture'], function(err, userData) {
				if (err) {
					return next(err);
				}

				async.parallel({
					scripts: function(next) {
						plugins.fireHook('filter:admin.scripts.get', [], function(err, scripts) {
							if (err) {
								return next(err);
							}
							var arr = [];
							scripts.forEach(function(script) {
								arr.push({src: nconf.get('url') + script});
							});

							next(null, arr);
						});
					},
					custom_header: function(next) {
						plugins.fireHook('filter:admin.header.build', custom_header, next);
					}
				}, function(err, pluginData) {
					if (err) {
						return next(err);
					}
					var data = {
						relative_path: nconf.get('relative_path'),
						plugins: pluginData.custom_header.plugins,
						authentication: pluginData.custom_header.authentication,
						scripts: pluginData.scripts,
						userpicture: userData.picture,
						username: userData.username,
						userslug: userData.userslug,
						'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
						env: process.env.NODE_ENV ? true : false
					};

					app.render('admin/header', data, function(err, template) {
						if (err) {
							return next(err);
						}
						res.locals.adminHeader = template;
						next();
					});
				});
			});
		},
		function(next) {
			controllers.api.getConfig(req, res, function(err, config) {
				res.locals.config = config;
				next(err);
			});
		},
		function(next) {
			app.render('admin/footer', {}, function(err, template) {
				res.locals.adminFooter = template;
				next(err);
			});
		}
	], next);
};

module.exports = function(webserver) {
	app = webserver;
	return middleware;
};
