'use strict';

const sitemap = require('../sitemap');
const meta = require('../meta');

const sitemapController = module.exports;

sitemapController.render = async function (req, res, next) {
	if (meta.config['feeds:disableSitemap']) {
		return setImmediate(next);
	}
	const tplData = await sitemap.render();
	const xml = await req.app.renderAsync('sitemap', tplData);
	res.header('Content-Type', 'application/xml');
	res.send(xml);
};

sitemapController.getPages = function (req, res, next) {
	sendSitemap(sitemap.getPages, res, next);
};

sitemapController.getCategories = function (req, res, next) {
	sendSitemap(sitemap.getCategories, res, next);
};

sitemapController.getTopicPage = function (req, res, next) {
	sendSitemap(async () => await sitemap.getTopicPage(parseInt(req.params[0], 10)), res, next);
};

async function sendSitemap(method, res, callback) {
	if (meta.config['feeds:disableSitemap']) {
		return setImmediate(callback);
	}
	const xml = await method();
	if (!xml) {
		return callback();
	}
	res.header('Content-Type', 'application/xml');
	res.send(xml);
}
