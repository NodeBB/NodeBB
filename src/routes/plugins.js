"use strict";

var	_ = require('underscore'),
	nconf = require('nconf'),
	path = require('path'),
	fs = require('fs'),
	validator = require('validator'),
	async = require('async'),
	winston = require('winston'),

	plugins = require('../plugins'),
	helpers = require('../controllers/helpers');


module.exports = function(app, middleware, controllers) {
	// Static Assets
	app.get('/plugins/:id/*', middleware.addExpiresHeaders, function(req, res, next) {
		var	relPath = req._parsedUrl.pathname.replace('/plugins/', ''),
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
				if (err) {
					return next(err);
				}
				matches = matches.filter(Boolean);

				if (matches.length) {
					res.sendFile(matches[0]);
				} else {
					helpers.notFound(req, res);
				}
			});
		} else {
			helpers.notFound(req, res);
		}
	});
};
