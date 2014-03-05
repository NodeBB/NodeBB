"use strict";

var	_ = require('underscore'),
	nconf = require('nconf'),
	path = require('path'),
	fs = require('fs'),
	validator = require('validator'),
	async = require('async'),

	plugins = require('../plugins');

function setupPluginRoutes(app) {
	var custom_routes = {
		'routes': [],
		'api': [],
		'templates': []
	};

	app.get_custom_templates = function() {
		return custom_routes.templates.map(function(tpl) {
			return tpl.template;
		});
	};

	plugins.ready(function() {
		/*
		* TO BE DEPRECATED post 0.4x and replaced with something that isn't as complicated as this...
		*/
		plugins.fireHook('filter:server.create_routes', custom_routes, function(err, custom_routes) {
			var route,
				routes = custom_routes.routes;

			for (route in routes) {
				if (routes.hasOwnProperty(route)) {
					(function(route) {
						app[routes[route].method || 'get'](routes[route].route, function(req, res) {
							routes[route].options(req, res, function(options) {
								/*app.build_header({
									req: options.req || req,
									res: options.res || res
								}, function (err, header) {
									//res.send(header + options.content + templates.footer);
								});*/
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

function setupPluginAdminRoutes(app) {
	var custom_routes = {
		'routes': [],
		'api': []
	};

	plugins.ready(function() {
		/*
		* TO BE DEPRECATED post 0.4x and replaced with something that isn't as complicated as this...
		*/
		plugins.fireHook('filter:admin.create_routes', custom_routes, function(err, custom_routes) {
			var route, routes = custom_routes.routes;

			for (route in routes) {
				if (routes.hasOwnProperty(route)) {
					(function(route) {
						app[routes[route].method || 'get']('/admin' + routes[route].route, function(req, res) {
							routes[route].options(req, res, function(options) {
								//Admin.buildHeader(req, res, function (err, header) {
									//res.send(header + options.content + templates['admin/footer']);
								//});
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