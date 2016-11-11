"use strict";

var path = require('path');
var nconf = require('nconf');

var meta = require('../meta');


function sendMinifiedJS(req, res) {
	var target = path.basename(req.path);
	var cache = meta.js.target[target] ? meta.js.target[target].cache : '';
	res.type('text/javascript').send(cache);
}

// The portions of code involving the source map are commented out as they're broken in UglifyJS2
// Follow along here: https://github.com/mishoo/UglifyJS2/issues/700
// function sendJSSourceMap(req, res) {
// 	if (meta.js.hasOwnProperty('map')) {
// 		res.type('application/json').send(meta.js.map);
// 	} else {
// 		res.redirect(404);
// 	}
// };

function sendStylesheet(req, res) {
	res.type('text/css').status(200).send(meta.css.cache);
}

function sendACPStylesheet(req, res) {
	res.type('text/css').status(200).send(meta.css.acpCache);
}

function sendSoundFile(req, res, next) {
	var resolved = meta.sounds._filePathHash[path.basename(req.path)];

	if (resolved) {
		res.status(200).sendFile(resolved);
	} else {
		next();
	}
}

module.exports = function (app, middleware, controllers) {
	app.get('/stylesheet.css', middleware.addExpiresHeaders, sendStylesheet);
	app.get('/admin.css', middleware.addExpiresHeaders, sendACPStylesheet);
	app.get('/nodebb.min.js', middleware.addExpiresHeaders, sendMinifiedJS);
	app.get('/acp.min.js', middleware.addExpiresHeaders, sendMinifiedJS);
	// app.get('/nodebb.min.js.map', middleware.addExpiresHeaders, sendJSSourceMap);
	app.get('/sitemap.xml', controllers.sitemap.render);
	app.get('/sitemap/pages.xml', controllers.sitemap.getPages);
	app.get('/sitemap/categories.xml', controllers.sitemap.getCategories);
	app.get(/\/sitemap\/topics\.(\d+)\.xml/, controllers.sitemap.getTopicPage);
	app.get('/robots.txt', controllers.robots);
	app.get('/manifest.json', controllers.manifest);
	app.get('/css/previews/:theme', controllers.admin.themes.get);

	if (nconf.get('local-assets') === false) {
		app.get('/sounds/*', middleware.addExpiresHeaders, sendSoundFile);
	}
};
