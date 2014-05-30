"use strict";

var path = require('path'),
	nconf = require('nconf'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins'),

	minificationEnabled = false;


function sendMinifiedJS(req, res, next) {
	if (!minificationEnabled) {
		res.set('X-SourceMap', '/nodebb.min.js.map');
	}

	return res.type('text/javascript').send(meta.js.cache);
}

function sendSourceMap(req, res) {
	return res.type('application/json').send(meta.js.map);
}

function sendStylesheet(req, res, next) {
	res.type('text/css').send(200, meta.css.cache);
}

function setupPluginSourceMapping(app) {
	/*
		These mappings are utilised by the source map file, as client-side
		scripts defined in `scripts` in plugin.json are not normally
		served to the end-user. These mappings are only accessible via
		development mode (`./nodebb dev`)
	*/
	var	routes = plugins.clientScripts,
		mapping,
		prefix = __dirname.split(path.sep).length - 1;

	routes.forEach(function(route) {
		mapping = path.sep + route.split('/').slice(prefix).join('/');
		app.get(mapping, function(req, res) {
			res.type('text/javascript').sendfile(route);
		});
	});
}

module.exports = function(app, middleware, controllers) {
	app.get('/stylesheet.css', sendStylesheet);
	app.get('/nodebb.min.js', sendMinifiedJS);
	app.get('/sitemap.xml', controllers.sitemap);
	app.get('/robots.txt', controllers.robots);

	if (!minificationEnabled) {
		app.get('/nodebb.min.js.map', sendSourceMap);
		setupPluginSourceMapping(app);
	}
};
