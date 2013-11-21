"use strict";

var	nconf = require('nconf'),
	path = require('path'),
	fs = require('fs'),
	Plugins = require('../plugins'),

	PluginRoutes = function(app) {
		app.get('/plugins/fireHook', function(req, res) {
			// GET = filter
			Plugins.fireHook('filter:' + req.query.hook, req.query.args, function(err, returnData) {
				if (typeof returnData === 'object') {
					res.json(200, returnData);
				} else {
					res.send(200, returnData);
				}
			});
		});

		app.put('/plugins/fireHook', function(req, res) {
			// PUT = action
			Plugins.fireHook('action:' + req.body.hook, req.body.args);
			res.send(200);
		});

		// Static Assets
		app.get('/plugins/:id/*', function(req, res) {
			var	relPath = req.url.replace('/plugins/' + req.params.id, '');
			if (Plugins.staticDirs[req.params.id]) {
				var	fullPath = path.join(Plugins.staticDirs[req.params.id], relPath);
				fs.exists(fullPath, function(exists) {
					if (exists) {
						res.sendfile(fullPath);
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