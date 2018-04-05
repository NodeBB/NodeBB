'use strict';

var async = require('async');
var sm = require('sitemap');
var nconf = require('nconf');

var db = require('./database');
var categories = require('./categories');
var topics = require('./topics');
var privileges = require('./privileges');
var meta = require('./meta');
var plugins = require('./plugins');
var utils = require('./utils');

var sitemap = {
	maps: {
		topics: [],
	},
};

sitemap.render = function (callback) {
	var topicsPerPage = parseInt(meta.config.sitemapTopics, 10) || 500;
	var returnData = {
		url: nconf.get('url'),
		topics: [],
	};

	async.waterfall([
		function (next) {
			db.getObjectField('global', 'topicCount', next);
		},
		function (topicCount, next) {
			var numPages = Math.ceil(Math.max(0, topicCount / topicsPerPage));
			for (var x = 1; x <= numPages; x += 1) {
				returnData.topics.push(x);
			}

			next(null, returnData);
		},
	], callback);
};

sitemap.getPages = function (callback) {
	if (
		sitemap.maps.pages &&
		Date.now() < parseInt(sitemap.maps.pages.cacheSetTimestamp, 10) + parseInt(sitemap.maps.pages.cacheResetPeriod, 10)
	) {
		return sitemap.maps.pages.toXML(callback);
	}

	var urls = [{
		url: '',
		changefreq: 'weekly',
		priority: 0.6,
	}, {
		url: '/recent',
		changefreq: 'daily',
		priority: 0.4,
	}, {
		url: '/users',
		changefreq: 'daily',
		priority: 0.4,
	}, {
		url: '/groups',
		changefreq: 'daily',
		priority: 0.4,
	}];

	plugins.fireHook('filter:sitemap.getPages', { urls: urls }, function (err, data) {
		if (err) {
			return callback(err);
		}
		sitemap.maps.pages = sm.createSitemap({
			hostname: nconf.get('url'),
			cacheTime: 1000 * 60 * 60 * 24,	// Cached for 24 hours
			urls: data.urls,
		});

		sitemap.maps.pages.toXML(callback);
	});
};

sitemap.getCategories = function (callback) {
	if (
		sitemap.maps.categories &&
		Date.now() < parseInt(sitemap.maps.categories.cacheSetTimestamp, 10) + parseInt(sitemap.maps.categories.cacheResetPeriod, 10)
	) {
		return sitemap.maps.categories.toXML(callback);
	}

	var categoryUrls = [];
	categories.getCategoriesByPrivilege('categories:cid', 0, 'find', function (err, categoriesData) {
		if (err) {
			return callback(err);
		}

		categoriesData.forEach(function (category) {
			if (category) {
				categoryUrls.push({
					url: '/category/' + category.slug,
					changefreq: 'weekly',
					priority: 0.4,
				});
			}
		});

		sitemap.maps.categories = sm.createSitemap({
			hostname: nconf.get('url'),
			cacheTime: 1000 * 60 * 60 * 24,	// Cached for 24 hours
			urls: categoryUrls,
		});

		sitemap.maps.categories.toXML(callback);
	});
};

sitemap.getTopicPage = function (page, callback) {
	if (parseInt(page, 10) <= 0) {
		return callback();
	}

	var numTopics = parseInt(meta.config.sitemapTopics, 10) || 500;
	var min = (parseInt(page, 10) - 1) * numTopics;
	var max = min + numTopics;

	if (
		sitemap.maps.topics[page - 1] &&
		Date.now() < parseInt(sitemap.maps.topics[page - 1].cacheSetTimestamp, 10) + parseInt(sitemap.maps.topics[page - 1].cacheResetPeriod, 10)
	) {
		return sitemap.maps.topics[page - 1].toXML(callback);
	}

	var topicUrls = [];

	async.waterfall([
		function (next) {
			db.getSortedSetRevRange('topics:recent', min, max, next);
		},
		function (tids, next) {
			privileges.topics.filterTids('read', tids, 0, next);
		},
		function (tids, next) {
			topics.getTopicsFields(tids, ['tid', 'title', 'slug', 'lastposttime'], next);
		},
	], function (err, topics) {
		if (err) {
			return callback(err);
		}

		topics.forEach(function (topic) {
			if (topic) {
				topicUrls.push({
					url: '/topic/' + topic.slug,
					lastmodISO: utils.toISOString(topic.lastposttime),
					changefreq: 'daily',
					priority: 0.6,
				});
			}
		});

		sitemap.maps.topics[page - 1] = sm.createSitemap({
			hostname: nconf.get('url'),
			cacheTime: 1000 * 60 * 60,	// Cached for 1 hour
			urls: topicUrls,
		});

		sitemap.maps.topics[page - 1].toXML(callback);
	});
};

sitemap.clearCache = function () {
	if (sitemap.obj) {
		sitemap.obj.clearCache();
	}
};

module.exports = sitemap;
