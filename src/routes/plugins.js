"use strict";

var	nconf = require('nconf'),
	path = require('path'),
	fs = require('fs'),
	validator = require('validator'),
	_ = require('underscore'),
	async = require('async'),
	plugins = require('../plugins'),

	PluginRoutes = function(app) {
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
	};

module.exports = PluginRoutes;
