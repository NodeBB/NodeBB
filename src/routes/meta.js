'use strict';

module.exports = function (app, middleware, controllers) {
	app.get('/sitemap.xml', controllers.sitemap.render);
	app.get('/sitemap/pages.xml', controllers.sitemap.getPages);
	app.get('/sitemap/categories.xml', controllers.sitemap.getCategories);
	app.get(/\/sitemap\/topics\.(\d+)\.xml/, controllers.sitemap.getTopicPage);
	app.get('/robots.txt', controllers.robots);
	app.get('/manifest.json', controllers.manifest);
	app.get('/css/previews/:theme', controllers.admin.themes.get);
	app.get('/osd.xml', controllers.osd.handle);
};
