"use strict";

var meta = require('../meta'),
	middleware = require('../middleware');


function sendMinifiedJS(req, res, next) {
	var cache = meta.js.target['nodebb.min.js'] ? meta.js.target['nodebb.min.js'].cache : '';
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
	// app.get('/nodebb.min.js.map', middleware.addExpiresHeaders, sendJSSourceMap);
	app.get('/sitemap.xml', controllers.sitemap.render);
	app.get('/sitemap/pages.xml', controllers.sitemap.getPages);
	app.get('/sitemap/categories.xml', controllers.sitemap.getCategories);
	app.get(/\/sitemap\/topics\.(\d+)\.xml/, controllers.sitemap.getTopicPage);
	app.get('/robots.txt', controllers.robots);
	app.get('/manifest.json', controllers.manifest);
	app.get('/css/previews/:theme', controllers.admin.themes.get);
};
