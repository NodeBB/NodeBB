'use strict';

const path = require('path');
const nconf = require('nconf');

module.exports = function (app, middleware, controllers) {
	app.get('/sitemap.xml', controllers.sitemap.render);
	app.get('/sitemap/pages.xml', controllers.sitemap.getPages);
	app.get('/sitemap/categories.xml', controllers.sitemap.getCategories);
	app.get(/\/sitemap\/topics\.(\d+)\.xml/, controllers.sitemap.getTopicPage);
	app.get('/robots.txt', controllers.robots);
	app.get('/manifest.webmanifest', controllers.manifest);
	app.get('/css/previews/:theme', controllers.admin.themes.get);
	app.get('/osd.xml', controllers.osd.handle);
	app.get('/service-worker.js', (req, res) => {
		res.status(200)
			.type('application/javascript')
			.set('Service-Worker-Allowed', `${nconf.get('relative_path')}/`)
			.sendFile(path.join(__dirname, '../../build/public/src/service-worker.js'));
	});
};
