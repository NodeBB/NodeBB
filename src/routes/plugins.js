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
			}).filter(Boolean);

		if (!matches) {
			return next();
		}

		matches = matches.map(function(mappedPath) {
			return path.join(plugins.staticDirs[mappedPath], decodeURIComponent(relPath.slice(mappedPath.length)));
		});

		if (matches.length) {
			res.sendFile(matches[0]);
		} else {
			next();
		}
	});
};
