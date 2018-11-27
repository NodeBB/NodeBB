'use strict';

var async = require('async');

var sitemap = require('../sitemap');
var meta = require('../meta');

var sitemapController = module.exports;

sitemapController.render = function (req, res, next) {
	if (meta.config['feeds:disableSitemap']) {
		return setImmediate(next);
	}
	async.waterfall([
		function (next) {
			sitemap.render(next);
		},
		function (tplData, next) {
			req.app.render('sitemap', tplData, next);
		},
		function (xml) {
			res.header('Content-Type', 'application/xml');
			res.send(xml);
		},
	], next);
};

sitemapController.getPages = function (req, res, next) {
	sendSitemap(sitemap.getPages, res, next);
};

sitemapController.getCategories = function (req, res, next) {
	sendSitemap(sitemap.getCategories, res, next);
};

sitemapController.getTopicPage = function (req, res, next) {
	sendSitemap(function (callback) {
		sitemap.getTopicPage(parseInt(req.params[0], 10), callback);
	}, res, next);
};

function sendSitemap(method, res, callback) {
	if (meta.config['feeds:disableSitemap']) {
		return setImmediate(callback);
	}
	async.waterfall([
		function (next) {
			method(next);
		},
		function (xml) {
			if (!xml) {
				return callback();
			}

			res.header('Content-Type', 'application/xml');
			res.send(xml);
		},
	], callback);
}
