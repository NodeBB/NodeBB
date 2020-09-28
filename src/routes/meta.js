'use strict';

module.exports = function (app, middleware, controllers) {
	app.get('/sitemap.xml', controllers.sitemap.render);
	app.get('/sitemap/pages.xml', controllers.sitemap.getPages);
	app.get('/sitemap/categories.xml', controllers.sitemap.getCategories);
	app.get(/\/sitemap\/topics\.(\d+)\.xml/, controllers.sitemap.getTopicPage);
	app.get('/robots.txt', controllers.robots);
	app.get('/manifest.webmanifest', controllers.manifest);
	app.get('/css/previews/:theme', controllers.admin.themes.get);
	app.get('/osd.xml', controllers.osd.handle);
	app.get('/service-worker.js', function (req, res) {
		res.set('Content-Type', 'application/javascript');
		res.send('self.addEventListener(\'fetch\', event => { event.respondWith( caches.match(event.request).then(response => { if (!response) { return fetch(event.request); } return response; }) ) });');
	});
};
