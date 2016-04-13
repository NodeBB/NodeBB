'use strict';

var async = require('async');
var sm = require('sitemap');
var nconf = require('nconf');

var db = require('./database');
var categories = require('./categories');
var topics = require('./topics');
var privileges = require('./privileges');
var meta = require('./meta');
var utils = require('../public/src/utils');

var sitemap = {
		maps: {
			topics: []
		}
	};

sitemap.render = function(callback) {
	var numTopics = parseInt(meta.config.sitemapTopics, 10) || 500;
	var returnData = {
			url: nconf.get('url'),
			topics: []
		};
	var numPages;

	async.waterfall([
		async.apply(db.getSortedSetRange, 'topics:recent', 0, -1),
		function(tids, next) {
			privileges.topics.filterTids('read', tids, 0, next);
		}
	], function(err, tids) {
		if (err) {
			numPages = 1;
		} else {
			numPages = Math.ceil(tids.length / numTopics);
		}

		for(var x=1;x<=numPages;x++) {
			returnData.topics.push(x);
		}

		callback(null, returnData);
	});
};

sitemap.getStaticUrls = function(callback) {
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
	}, {
		url: '/groups',
		changefreq: 'daily',
		priority: '0.4'
	}]);
};

sitemap.getPages = function(callback) {
	if (sitemap.maps.pages && sitemap.maps.pages.cache.length) {
		return sitemap.maps.pages.toXML(callback);
	}

	var urls = [{
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
		}, {
			url: '/groups',
			changefreq: 'daily',
			priority: '0.4'
		}];

	sitemap.maps.pages = sm.createSitemap({
		hostname: nconf.get('url'),
		cacheTime: 1000 * 60 * 60 * 24,	// Cached for 24 hours
		urls: urls
	});

	sitemap.maps.pages.toXML(callback);
};

sitemap.getCategories = function(callback) {
	if (sitemap.maps.categories && sitemap.maps.categories.cache.length) {
		return sitemap.maps.categories.toXML(callback);
	}

	var categoryUrls = [];
	categories.getCategoriesByPrivilege('categories:cid', 0, 'find', function(err, categoriesData) {
		if (err) {
			return callback(err);
		}

		categoriesData.forEach(function(category) {
			if (category) {
				categoryUrls.push({
					url: '/category/' + category.slug,
					changefreq: 'weekly',
					priority: '0.4'
				});
			}
		});

		sitemap.maps.categories = sm.createSitemap({
			hostname: nconf.get('url'),
			cacheTime: 1000 * 60 * 60 * 24,	// Cached for 24 hours
			urls: categoryUrls
		});

		sitemap.maps.categories.toXML(callback);
	});
};

sitemap.getTopicPage = function(page, callback) {
	if (parseInt(page, 10) <= 0) {
		return callback();
	}

	var numTopics = parseInt(meta.config.sitemapTopics, 10) || 500;
	var min = (parseInt(page, 10) - 1) * numTopics;
	var max = min + numTopics;

	if (sitemap.maps.topics[page-1] && sitemap.maps.topics[page-1].cache.length) {
		return sitemap.maps.topics[page-1].toXML(callback);
	}

	var topicUrls = [];

	async.waterfall([
		function(next) {
			db.getSortedSetRevRange('topics:recent', min, max, next);
		},
		function(tids, next) {
			privileges.topics.filterTids('read', tids, 0, next);
		},
		function(tids, next) {
			topics.getTopicsFields(tids, ['tid', 'title', 'slug', 'lastposttime'], next);
		}
	], function(err, topics) {
		if (err) {
			return callback(err);
		}

		topics.forEach(function(topic) {
			if (topic) {
				topicUrls.push({
					url: '/topic/' + topic.slug,
					lastmodISO: utils.toISOString(topic.lastposttime),
					changefreq: 'daily',
					priority: '0.6'
				});
			}
		});

		sitemap.maps.topics[page-1] = sm.createSitemap({
			hostname: nconf.get('url'),
			cacheTime: 1000 * 60 * 60,	// Cached for 1 hour
			urls: topicUrls
		});

		sitemap.maps.topics[page-1].toXML(callback);
	});
};

sitemap.clearCache = function() {
	if (sitemap.obj) {
		sitemap.obj.clearCache();
	}
};

module.exports = sitemap;
