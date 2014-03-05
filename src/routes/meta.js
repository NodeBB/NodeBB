"use strict";

var path = require('path'),
	nconf = require('nconf'),
	less = require('less'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins'),

	minificationEnabled = false;


function sendMinifiedJS(req, res, next) {
	function sendCached() {
		return res.type('text/javascript').send(meta.js.cache);
	}

	if (meta.js.cache) {
		sendCached();
	} else {
		if (minificationEnabled) {
			meta.js.minify(function() {
				sendCached();
			});
		} else {
			// Compress only
			meta.js.concatenate(function() {
				sendCached();
			});
		}
	}
}

function sendStylesheet(req, res, next) {
	if (meta.css.cache) {
		res.type('text/css').send(200, meta.css.cache);
		return;
	}

	db.getObjectFields('config', ['theme:type', 'theme:id'], function(err, themeData) {
		var themeId = (themeData['theme:id'] || 'nodebb-theme-vanilla'),
			baseThemePath = path.join(nconf.get('themes_path'), (themeData['theme:type'] && themeData['theme:type'] === 'local' ? themeId : 'nodebb-theme-vanilla')),
			paths = [baseThemePath, path.join(__dirname, '../../node_modules')],
			source = '@import "./theme";',
			x, numLESS;

		// Add the imports for each LESS file
		for(x=0,numLESS=plugins.lessFiles.length;x<numLESS;x++) {
			source += '\n@import "./' + plugins.lessFiles[x] + '";';
		}

		var	parser = new (less.Parser)({
				paths: paths
			});

		parser.parse(source, function(err, tree) {
			if (err) {
				res.send(500, err.message);
				return;
			}

			meta.css.cache = tree.toCSS({
				compress: true
			});
			res.type('text/css').send(200, meta.css.cache);
		});
	});
}

module.exports = function(app, middleware, controllers) {
	minificationEnabled = app.enabled('minification');

	app.get('/stylesheet.css', sendStylesheet);
	app.get('/nodebb.min.js', sendMinifiedJS);
	app.get('/sitemap.xml', controllers.sitemap);
	app.get('/robots.txt', controllers.robots);
};