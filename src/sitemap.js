'use strict';

var path = require('path'),
	async = require('async'),
	sm = require('sitemap'),
	url = require('url'),
	nconf = require('nconf'),
	categories = require('./categories'),
	topics = require('./topics'),
	utils = require('../public/src/utils'),
	sitemap = {
		obj: undefined,
		getStaticUrls: function(callback) {
			callback(null, [{
				url: '',
				changefreq: 'weekly',
				priority: '0.6'
			}, {
				url: '/recent',
				changefreq: 'daily',
				priority: '0.4'
			}, {
				url: '/users',
				changefreq: 'daily',
				priority: '0.4'
			}]);
		},
		getDynamicUrls: function(callback) {
			var returnUrls = [];

			async.parallel([
				function(next) {
					var categoryUrls = [];
					categories.getCategoriesByPrivilege(0, 'find', function(err, categoriesData) {
						if (err) {
							return next(err);
						}

						categoriesData.forEach(function(category) {
							categoryUrls.push({
								url: path.join('/category', category.slug),
								changefreq: 'weekly',
								priority: '0.4'
							});
						});

						next(null, categoryUrls);
					});
				},
				function(next) {
					var topicUrls = [];
					topics.getTopicsFromSet(0, 'topics:recent', 0, 49, function(err, data) {
						if (err) {
							return next(err);
						}

						data.topics.forEach(function(topic) {
							topicUrls.push({
								url: path.join('/topic', topic.slug),
								lastmodISO: utils.toISOString(topic.lastposttime),
								changefreq: 'daily',
								priority: '0.6'
							});
						});

						next(null, topicUrls);
					});
				}
			], function(err, data) {
				if (!err) {
					returnUrls = returnUrls.concat(data[0]).concat(data[1]);
				}

				callback(err, returnUrls);
			});
		},
		render: function(callback) {
			if (sitemap.obj !== undefined && sitemap.obj.cache.length) {
				sitemap.obj.toXML(callback);
			} else {
				async.parallel([sitemap.getStaticUrls, sitemap.getDynamicUrls], function(err, urls) {
					urls = urls[0].concat(urls[1]);
					sitemap.obj = sm.createSitemap({
						hostname: nconf.get('url'),
						cacheTime: 1000 * 60 * 60,	// Cached for 1 hour
						urls: urls
					});

					sitemap.obj.toXML(callback);
				});
			}
		}
	};

module.exports = sitemap;
