'use strict';

module.exports = function (app, middleware, controllers) {
	const routeHelpers = require('./helpers');
	app.get('/sitemap.xml', routeHelpers.tryRoute(controllers.sitemap.render));
	app.get('/sitemap/pages.xml', routeHelpers.tryRoute(controllers.sitemap.getPages));
	app.get('/sitemap/categories.xml', routeHelpers.tryRoute(controllers.sitemap.getCategories));
	app.get(/\/sitemap\/topics\.(\d+)\.xml/, routeHelpers.tryRoute(controllers.sitemap.getTopicPage));
	app.get('/robots.txt', routeHelpers.tryRoute(controllers.robots));
	app.get('/manifest.webmanifest', routeHelpers.tryRoute(controllers.manifest));
	app.get('/css/previews/:theme', routeHelpers.tryRoute(controllers.admin.themes.get));
	app.get('/osd.xml', routeHelpers.tryRoute(controllers.osd.handle));
	app.get('/service-worker.js', routeHelpers.tryRoute(controllers['service-worker'].generate));
};
