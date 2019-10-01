'use strict';

const { Sitemap } = require('sitemap');
const nconf = require('nconf');

const db = require('./database');
const categories = require('./categories');
const topics = require('./topics');
const privileges = require('./privileges');
const meta = require('./meta');
const plugins = require('./plugins');
const utils = require('./utils');

const sitemap = module.exports;
sitemap.maps = {
	topics: [],
};

sitemap.render = async function () {
	const topicsPerPage = meta.config.sitemapTopics;
	const returnData = {
		url: nconf.get('url'),
		topics: [],
	};
	const topicCount = await db.getObjectField('global', 'topicCount');
	const numPages = Math.ceil(Math.max(0, topicCount / topicsPerPage));
	for (var x = 1; x <= numPages; x += 1) {
		returnData.topics.push(x);
	}

	return returnData;
};

sitemap.getPages = async function () {
	if (
		sitemap.maps.pages &&
		Date.now() < parseInt(sitemap.maps.pages.cacheSetTimestamp, 10) + parseInt(sitemap.maps.pages.cacheResetPeriod, 10)
	) {
		return sitemap.maps.pages.toXML();
	}

	const urls = [{
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

	const data = await plugins.fireHook('filter:sitemap.getPages', { urls: urls });
	sitemap.maps.pages = new Sitemap({
		hostname: nconf.get('url'),
		cacheTime: 1000 * 60 * 60 * 24,	// Cached for 24 hours
		urls: data.urls,
	});

	return sitemap.maps.pages.toXML();
};

sitemap.getCategories = async function () {
	if (
		sitemap.maps.categories &&
		Date.now() < parseInt(sitemap.maps.categories.cacheSetTimestamp, 10) + parseInt(sitemap.maps.categories.cacheResetPeriod, 10)
	) {
		return sitemap.maps.categories.toXML();
	}

	const categoryUrls = [];
	const categoriesData = await categories.getCategoriesByPrivilege('categories:cid', 0, 'find');
	categoriesData.forEach(function (category) {
		if (category) {
			categoryUrls.push({
				url: '/category/' + category.slug,
				changefreq: 'weekly',
				priority: 0.4,
			});
		}
	});

	sitemap.maps.categories = new Sitemap({
		hostname: nconf.get('url'),
		cacheTime: 1000 * 60 * 60 * 24,	// Cached for 24 hours
		urls: categoryUrls,
	});

	return sitemap.maps.categories.toXML();
};

sitemap.getTopicPage = async function (page) {
	if (parseInt(page, 10) <= 0) {
		return;
	}

	const numTopics = meta.config.sitemapTopics;
	const min = (parseInt(page, 10) - 1) * numTopics;
	const max = min + numTopics;

	if (
		sitemap.maps.topics[page - 1] &&
		Date.now() < parseInt(sitemap.maps.topics[page - 1].cacheSetTimestamp, 10) + parseInt(sitemap.maps.topics[page - 1].cacheResetPeriod, 10)
	) {
		return sitemap.maps.topics[page - 1].toXML();
	}

	const topicUrls = [];
	let tids = await db.getSortedSetRevRange('topics:recent', min, max);
	tids = await privileges.topics.filterTids('topics:read', tids, 0);
	const topicData = await topics.getTopicsFields(tids, ['tid', 'title', 'slug', 'lastposttime']);

	topicData.forEach(function (topic) {
		if (topic) {
			topicUrls.push({
				url: '/topic/' + topic.slug,
				lastmodISO: utils.toISOString(topic.lastposttime),
				changefreq: 'daily',
				priority: 0.6,
			});
		}
	});

	sitemap.maps.topics[page - 1] = new Sitemap({
		hostname: nconf.get('url'),
		cacheTime: 1000 * 60 * 60,	// Cached for 1 hour
		urls: topicUrls,
	});

	return sitemap.maps.topics[page - 1].toXML();
};

sitemap.clearCache = function () {
	if (sitemap.obj) {
		sitemap.obj.clearCache();
	}
};

require('./promisify')(sitemap);
