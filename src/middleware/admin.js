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
		return controllers.helpers.notAllowed(req, res);
	}

	user.isAdministrator(req.user.uid, function (err, isAdmin) {
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

				userData.uid = uid;

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
					},
					config: function(next) {
						controllers.api.getConfig(req, res, next);
					}
				}, function(err, results) {
					if (err) {
						return next(err);
					}
					res.locals.config = results.config;
					var data = {
						relative_path: nconf.get('relative_path'),
						configJSON: JSON.stringify(results.config),
						userJSON: JSON.stringify(userData),
						plugins: results.custom_header.plugins,
						authentication: results.custom_header.authentication,
						scripts: results.scripts,
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
