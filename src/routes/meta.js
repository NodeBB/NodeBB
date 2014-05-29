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

module.exports = function(app, middleware, controllers) {
	app.get('/stylesheet.css', sendStylesheet);
	app.get('/nodebb.min.js', sendMinifiedJS);
	app.get('/sitemap.xml', controllers.sitemap);
	app.get('/robots.txt', controllers.robots);

	if (!minificationEnabled) {
		app.get('/nodebb.min.js.map', sendSourceMap);
	}
};
