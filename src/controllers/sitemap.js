'use strict';

var sitemap = require('../sitemap');
var meta = require('../meta');

var sitemapController = {};
sitemapController.render = function(req, res, next) {
	sitemap.render(function(err, tplData) {
		if (err) {
			return next(err);
		}

		req.app.render('sitemap', tplData, function(err, xml) {
			if (err) {
				return next(err);
			}
			res.header('Content-Type', 'application/xml');
			res.send(xml);
		});
	});
};

sitemapController.getPages = function(req, res, next) {
	if (parseInt(meta.config['feeds:disableSitemap'], 10) === 1) {
		return next();
	}

	sitemap.getPages(function(err, xml) {
		if (err) {
			return next(err);
		}
		res.header('Content-Type', 'application/xml');
		res.send(xml);
	});
};

sitemapController.getCategories = function(req, res, next) {
	if (parseInt(meta.config['feeds:disableSitemap'], 10) === 1) {
		return next();
	}

	sitemap.getCategories(function(err, xml) {
		if (err) {
			return next(err);
		}
		res.header('Content-Type', 'application/xml');
		res.send(xml);
	});
};

sitemapController.getTopicPage = function(req, res, next) {
	if (parseInt(meta.config['feeds:disableSitemap'], 10) === 1) {
		return next();
	}

	sitemap.getTopicPage(parseInt(req.params[0], 10), function(err, xml) {
		if (err) {
			return next(err);
		} else if (!xml) {
			return next();
		}

		res.header('Content-Type', 'application/xml');
		res.send(xml);
	});
};

module.exports = sitemapController;