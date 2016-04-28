"use strict";

var _ = require('underscore');
var path = require('path');

var plugins = require('../plugins');

module.exports = function(app, middleware, controllers) {
	// Static Assets
	app.get('/plugins/:id/*', middleware.addExpiresHeaders, function(req, res, next) {

		var relPath = req._parsedUrl.pathname.replace('/plugins/', '');

		var matches = _.map(plugins.staticDirs, function(realPath, mappedPath) {
			if (relPath.match(mappedPath)) {
				var pathToFile = path.join(plugins.staticDirs[mappedPath], decodeURIComponent(relPath.slice(mappedPath.length)));
				if (pathToFile.startsWith(plugins.staticDirs[mappedPath])) {
					return pathToFile;
				}
			}

			return null;
		}).filter(Boolean);

		if (!matches || !matches.length) {
			return next();
		}

		res.sendFile(matches[0], {}, function(err) {
			if (err) {
				if (err.code === 'ENOENT') {
					// File doesn't exist, this isn't an error, to send to 404 handler
					return next();
				} else {
					return next(err);
				}
			}
		});
	});
};