'use strict';

var path = require('path'),
	async = require('async'),
	sm = require('sitemap'),
	url = require('url'),
	nconf = require('nconf'),
	db = require('./database'),
	categories = require('./categories'),
	topics = require('./topics'),
	privileges = require('./privileges'),
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

			async.parallel({
				categoryUrls: function(next) {
					var categoryUrls = [];
					categories.getCategoriesByPrivilege(0, 'find', function(err, categoriesData) {
						if (err) {
							return next(err);
						}

						categoriesData.forEach(function(category) {
							if (category) {
								categoryUrls.push({
									url: '/category/' + category.cid + '/' + encodeURIComponent(utils.slugify(category.name)),
									changefreq: 'weekly',
									priority: '0.4'
								});
							}
						});

						next(null, categoryUrls);
					});
				},
				topicUrls: function(next) {
					var topicUrls = [];

					db.getSortedSetRevRange('topics:recent', 0, 49, function(err, tids) {
						if (err) {
							return next(err);
						}
						privileges.topics.filter('read', tids, 0, function(err, tids) {
							if (err) {
								return next(err);
							}

							topics.getTopicsFields(tids, ['tid', 'title', 'lastposttime'], function(err, topics) {
								if (err) {
									return next(err);
								}

								topics.forEach(function(topic) {
									if (topic) {
										topicUrls.push({
											url: '/topic/' + topic.tid + '/' + encodeURIComponent(utils.slugify(topic.title)),
											lastmodISO: utils.toISOString(topic.lastposttime),
											changefreq: 'daily',
											priority: '0.6'
										});
									}
								});

								next(null, topicUrls);
							});
						});
					});
				}
			}, function(err, data) {
				if (!err) {
					returnUrls = data.categoryUrls.concat(data.topicUrls);
				}

				callback(err, returnUrls);
			});
		},
		render: function(callback) {
			if (sitemap.obj !== undefined && sitemap.obj.cache.length) {
				return sitemap.obj.toXML(callback);
			}

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
	};

module.exports = sitemap;
