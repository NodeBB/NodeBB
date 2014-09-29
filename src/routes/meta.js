"use strict";

var path = require('path'),
	nconf = require('nconf'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins'),
	middleware = require('../middleware'),

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

function sendACPStylesheet(req, res, next) {
	res.type('text/css').send(200, meta.css.acpCache);	
}

function setupPluginSourceMapping(app) {
	/*
		These mappings are utilised by the source map file, as client-side
		scripts defined in `scripts` in plugin.json are not normally
		served to the end-user. These mappings are only accessible via
		development mode (`./nodebb dev`)
	*/
	var	routes = plugins.clientScripts,
		prefix = __dirname.split(path.sep).length - 1,
		mapping;

	routes.forEach(function(route) {
		mapping = '/' + route.split(path.sep).slice(prefix).join('/');
		app.get(mapping, function(req, res) {
			res.type('text/javascript').sendfile(route);
		});
	});
}

module.exports = function(app, middleware, controllers) {
	app.get('/stylesheet.css', middleware.addExpiresHeaders, sendStylesheet);
	app.get('/admin.css', middleware.addExpiresHeaders, sendACPStylesheet);
	app.get('/nodebb.min.js', middleware.addExpiresHeaders, sendMinifiedJS);
	app.get('/sitemap.xml', controllers.sitemap);
	app.get('/robots.txt', controllers.robots);
	app.get('/css/previews/:theme', controllers.admin.themes.get);

	if (!minificationEnabled) {
		app.get('/nodebb.min.js.map', middleware.addExpiresHeaders, sendSourceMap);
		setupPluginSourceMapping(app);
	}
};
