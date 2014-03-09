"use strict";

var	_ = require('underscore'),
	nconf = require('nconf'),
	path = require('path'),
	fs = require('fs'),
	validator = require('validator'),
	async = require('async'),
	winston = require('winston'),

	plugins = require('../plugins'),
	pluginRoutes = [];

/*
* TO BE DEPRECATED post 0.4x
*/
function setupPluginRoutes(app) {
	var custom_routes = {
		'routes': [],
		'api': [],
		'templates': []
	};

	plugins.ready(function() {
		plugins.fireHook('filter:server.create_routes', custom_routes, function(err, custom_routes) {
			winston.warn('[plugins] filter:server.create_routes is deprecated and will maintain limited functionality until 0.4x');
			var route,
				routes = custom_routes.routes;

			pluginRoutes = custom_routes;

			for (route in routes) {
				if (routes.hasOwnProperty(route)) {
					(function(route) {
						app[routes[route].method || 'get'](routes[route].route, function(req, res) {
							routes[route].options(req, res, function(options) {
								async.parallel([
									function(next) {
										app.render('header', {}, next);
									},
									function(next) {
										app.render('footer', {}, next);
									}
								], function(err, data) {
									res.send(data[0] + options.content + data[1]);
								});
							});
						});
					}(route));
				}
			}

			var apiRoutes = custom_routes.api;
			for (route in apiRoutes) {
				if (apiRoutes.hasOwnProperty(route)) {
					(function(route) {
						app[apiRoutes[route].method || 'get']('/api' + apiRoutes[route].route, function(req, res) {
							apiRoutes[route].callback(req, res, function(data) {
								res.json(data);
							});
						});
					}(route));
				}
			}

			var templateRoutes = custom_routes.templates;
			for (route in templateRoutes) {
				if (templateRoutes.hasOwnProperty(route)) {
					(function(route) {
						app.get('/templates/' + templateRoutes[route].template, function(req, res) {
							res.send(templateRoutes[route].content);
						});
					}(route));
				}
			}
		});
	});
}

/*
* TO BE DEPRECATED post 0.4x
*/
function setupPluginAdminRoutes(app) {
	var custom_routes = {
		'routes': [],
		'api': []
	};

	plugins.ready(function() {
		plugins.fireHook('filter:admin.create_routes', custom_routes, function(err, custom_routes) {
			winston.warn('[plugins] filter:admin.create_routes is deprecated and will maintain limited functionality until 0.4x');
			var route, routes = custom_routes.routes;

			for (route in routes) {
				if (routes.hasOwnProperty(route)) {
					(function(route) {
						app[routes[route].method || 'get']('/admin' + routes[route].route, function(req, res) {
							routes[route].options(req, res, function(options) {
								async.parallel([
									function(next) {
										app.render('admin/header', {}, next);
									},
									function(next) {
										app.render('admin/footer', {}, next);
									}
								], function(err, data) {
									res.send(data[0] + options.content + data[1]);
								});
							});
						});
					}(route));
				}
			}

			var apiRoutes = custom_routes.api;
			for (route in apiRoutes) {
				if (apiRoutes.hasOwnProperty(route)) {
					(function(route) {
						app[apiRoutes[route].method || 'get']('/api/admin' + apiRoutes[route].route, function(req, res) {
							apiRoutes[route].callback(req, res, function(data) {
								res.json(data);
							});
						});
					}(route));
				}
			}
		});
	});
}

module.exports = function(app, middleware, controllers) {
	/**
	* GET/PUT /plugins/fireHook to be deprecated after 0.4.x
	*
	*/
	app.get('/plugins/fireHook', function(req, res) {
		// GET = filter
		plugins.fireHook('filter:' + req.query.hook, req.query.args, function(err, returnData) {
			if (typeof returnData === 'object') {
				res.json(200, returnData);
			} else {
				res.send(200, validator.escape(returnData));
			}
		});
	});

	app.put('/plugins/fireHook', function(req, res) {
		// PUT = action
		var	hook = 'action:' + req.body.hook;
		if (plugins.hasListeners(hook)) {
			// Hook executes
			plugins.fireHook(hook, req.body.args);
		}

		res.send(200);
	});

	// Static Assets
	app.get('/plugins/:id/*', function(req, res) {
		var	relPath = req._parsedUrl.pathname.replace(nconf.get('relative_path') + '/plugins/', ''),
			matches = _.map(plugins.staticDirs, function(realPath, mappedPath) {
				if (relPath.match(mappedPath)) {
					return mappedPath;
				} else {
					return null;
				}
			}).filter(function(a) { return a; });

		if (matches) {
			async.map(matches, function(mappedPath, next) {
				var	filePath = path.join(plugins.staticDirs[mappedPath], decodeURIComponent(relPath.slice(mappedPath.length)));

				fs.exists(filePath, function(exists) {
					if (exists) {
						next(null, filePath);
					} else {
						next();
					}
				});
			}, function(err, matches) {
				// Filter out the nulls
				matches = matches.filter(function(a) {
					return a;
				});

				if (matches.length) {
					res.sendfile(matches[0]);
				} else {
					res.redirect('/404');
				}
			});
		} else {
			res.redirect('/404');
		}
	});

	setupPluginRoutes(app);
	setupPluginAdminRoutes(app);
};