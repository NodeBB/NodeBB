"use strict";

var path = require('path'),
	nconf = require('nconf'),

	meta = require('../meta'),
	db = require('../database'),
	plugins = require('../plugins'),
	middleware = require('../middleware');


function sendMinifiedJS(req, res, next) {
	res.set('X-SourceMap', '/nodebb.min.js.map');
	return res.type('text/javascript').send(meta.js.cache);
}

function sendStylesheet(req, res, next) {
	res.type('text/css').status(200).send(meta.css.cache);
}

function sendACPStylesheet(req, res, next) {
	res.type('text/css').status(200).send(meta.css.acpCache);
}

module.exports = function(app, middleware, controllers) {
	app.get('/stylesheet.css', middleware.addExpiresHeaders, sendStylesheet);
	app.get('/admin.css', middleware.addExpiresHeaders, sendACPStylesheet);
	app.get('/nodebb.min.js', middleware.addExpiresHeaders, sendMinifiedJS);
	app.get('/sitemap.xml', controllers.sitemap);
	app.get('/robots.txt', controllers.robots);
	app.get('/css/previews/:theme', controllers.admin.themes.get);
};
