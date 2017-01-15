"use strict";

var path = require('path');
var nconf = require('nconf');

var meta = require('../meta');

function sendSoundFile(req, res, next) {
	var resolved = meta.sounds._filePathHash[path.basename(req.path)];

	if (resolved) {
		res.status(200).sendFile(resolved);
	} else {
		next();
	}
}

module.exports = function (app, middleware, controllers) {
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
