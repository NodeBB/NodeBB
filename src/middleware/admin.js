'use strict';

var async = require('async');
var winston = require('winston');
var user = require('../user');
var meta = require('../meta');
var plugins = require('../plugins');

var controllers = {
	api: require('../controllers/api'),
	helpers: require('../controllers/helpers'),
};

module.exports = function (middleware) {
	middleware.admin = {};
	middleware.admin.isAdmin = function (req, res, next) {
		winston.warn('[middleware.admin.isAdmin] deprecation warning, no need to use this from plugins!');

		async.waterfall([
			function (next) {
				user.isAdministrator(req.uid, next);
			},
			function (isAdmin, next) {
				if (!isAdmin) {
					return controllers.helpers.notAllowed(req, res);
				}
				next();
			},
		], next);
	};

	middleware.admin.buildHeader = function (req, res, next) {
		res.locals.renderAdminHeader = true;

		controllers.api.getConfig(req, res, function (err, config) {
			if (err) {
				return next(err);
			}

			res.locals.config = config;
			next();
		});
	};

	middleware.admin.renderHeader = function (req, res, data, next) {
		var custom_header = {
			plugins: [],
			authentication: [],
		};

		user.getUserFields(req.uid, ['username', 'userslug', 'email', 'picture', 'email:confirmed'], function (err, userData) {
			if (err) {
				return next(err);
			}

			userData.uid = req.uid;
			userData['email:confirmed'] = parseInt(userData['email:confirmed'], 10) === 1;

			async.parallel({
				scripts: function (next) {
					plugins.fireHook('filter:admin.scripts.get', [], function (err, scripts) {
						if (err) {
							return next(err);
						}
						var arr = [];
						scripts.forEach(function (script) {
							arr.push({ src: script });
						});

						next(null, arr);
					});
				},
				custom_header: function (next) {
					plugins.fireHook('filter:admin.header.build', custom_header, next);
				},
				config: function (next) {
					controllers.api.getConfig(req, res, next);
				},
				configs: function (next) {
					meta.configs.list(next);
				},
			}, function (err, results) {
				if (err) {
					return next(err);
				}
				res.locals.config = results.config;

				var acpPath = req.path.slice(1).split('/');
				acpPath.forEach(function (path, i) {
					acpPath[i] = path.charAt(0).toUpperCase() + path.slice(1);
				});
				acpPath = acpPath.join(' > ');

				var templateValues = {
					config: results.config,
					configJSON: JSON.stringify(results.config),
					relative_path: results.config.relative_path,
					adminConfigJSON: encodeURIComponent(JSON.stringify(results.configs)),
					user: userData,
					userJSON: JSON.stringify(userData).replace(/'/g, "\\'"),
					plugins: results.custom_header.plugins,
					authentication: results.custom_header.authentication,
					scripts: results.scripts,
					'cache-buster': meta.config['cache-buster'] || '',
					env: !!process.env.NODE_ENV,
					title: (acpPath || 'Dashboard') + ' | NodeBB Admin Control Panel',
					bodyClass: data.bodyClass,
				};

				templateValues.template = { name: res.locals.template };
				templateValues.template[res.locals.template] = true;

				req.app.render('admin/header', templateValues, next);
			});
		});
	};


	middleware.admin.renderFooter = function (req, res, data, next) {
		req.app.render('admin/footer', data, next);
	};
};
