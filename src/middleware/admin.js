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
	res.locals.renderAdminHeader = true;

	async.parallel({
		config: function(next) {
			controllers.api.getConfig(req, res, next);
		},
		footer: function(next) {
			app.render('admin/footer', {}, next);
		}
	}, function(err, results) {
		if (err) {
			return next(err);
		}

		res.locals.config = results.config;
		res.locals.adminFooter = results.footer;
		next();
	});
};

middleware.renderHeader = function(req, res, next) {
	var custom_header = {
		'plugins': [],
		'authentication': []
	};

	user.getUserFields(req.uid, ['username', 'userslug', 'email', 'picture', 'email:confirmed'], function(err, userData) {
		if (err) {
			return next(err);
		}

		userData.uid = req.uid;
		userData['email:confirmed'] = parseInt(userData['email:confirmed'], 10) === 1;

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
				user: userData,
				userJSON: JSON.stringify(userData),
				plugins: results.custom_header.plugins,
				authentication: results.custom_header.authentication,
				scripts: results.scripts,
				'cache-buster': meta.config['cache-buster'] ? 'v=' + meta.config['cache-buster'] : '',
				env: process.env.NODE_ENV ? true : false,
			};

			data.template = {name: res.locals.template};
			data.template[res.locals.template] = true;

			app.render('admin/header', data, next);
		});
	});
};

module.exports = function(webserver) {
	app = webserver;
	return middleware;
};
