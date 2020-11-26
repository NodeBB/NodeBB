'use strict';

const { SitemapStream, streamToPromise } = require('sitemap');
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
	if (sitemap.maps.pages && Date.now() < sitemap.maps.pagesCacheExpireTimestamp) {
		return sitemap.maps.pages.toString();
	}

	const urls = [{
		url: '',
		changefreq: 'weekly',
		priority: 0.6,
	}, {
		url: `${nconf.get('relative_path')}/recent`,
		changefreq: 'daily',
		priority: 0.4,
	}, {
		url: `${nconf.get('relative_path')}/users`,
		changefreq: 'daily',
		priority: 0.4,
	}, {
		url: `${nconf.get('relative_path')}/groups`,
		changefreq: 'daily',
		priority: 0.4,
	}];

	const data = await plugins.hooks.fire('filter:sitemap.getPages', { urls: urls });

	const smStream = new SitemapStream({ hostname: nconf.get('url') });
	data.urls.forEach(url => smStream.write(url));
	smStream.end();

	sitemap.maps.pages = await streamToPromise(smStream);
	sitemap.maps.pagesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
	return sitemap.maps.pages.toString();
};

sitemap.getCategories = async function () {
	if (sitemap.maps.categories && Date.now() < sitemap.maps.categoriesCacheExpireTimestamp) {
		return sitemap.maps.categories.toString();
	}

	const categoryUrls = [];
	const categoriesData = await categories.getCategoriesByPrivilege('categories:cid', 0, 'find');
	categoriesData.forEach(function (category) {
		if (category) {
			categoryUrls.push({
				url: `${nconf.get('relative_path')}/category/` + category.slug,
				changefreq: 'weekly',
				priority: 0.4,
			});
		}
	});

	const smStream = new SitemapStream({ hostname: nconf.get('url') });
	categoryUrls.forEach(url => smStream.write(url));
	smStream.end();

	sitemap.maps.categories = await streamToPromise(smStream);
	sitemap.maps.categoriesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
	return sitemap.maps.categories.toString();
};

sitemap.getTopicPage = async function (page) {
	if (parseInt(page, 10) <= 0) {
		return;
	}

	const numTopics = meta.config.sitemapTopics;
	const min = (parseInt(page, 10) - 1) * numTopics;
	const max = min + numTopics;

	if (sitemap.maps.topics[page - 1] && Date.now() < sitemap.maps.topics[page - 1].cacheExpireTimestamp) {
		return sitemap.maps.topics[page - 1].sm.toString();
	}

	const topicUrls = [];
	let tids = await db.getSortedSetRange('topics:tid', min, max);
	tids = await privileges.topics.filterTids('topics:read', tids, 0);
	const topicData = await topics.getTopicsFields(tids, ['tid', 'title', 'slug', 'lastposttime']);

	topicData.forEach(function (topic) {
		if (topic) {
			topicUrls.push({
				url: `${nconf.get('relative_path')}/topic/` + topic.slug,
				lastmodISO: utils.toISOString(topic.lastposttime),
				changefreq: 'daily',
				priority: 0.6,
			});
		}
	});

	const smStream = new SitemapStream({ hostname: nconf.get('url') });
	topicUrls.forEach(url => smStream.write(url));
	smStream.end();

	sitemap.maps.topics[page - 1] = {
		sm: await streamToPromise(smStream),
		cacheExpireTimestamp: Date.now() + (1000 * 60 * 60 * 24),
	};

	return sitemap.maps.topics[page - 1].sm.toString();
};

sitemap.clearCache = function () {
	if (sitemap.maps.pages) {
		sitemap.maps.pagesCacheExpireTimestamp = 0;
	}
	if (sitemap.maps.categories) {
		sitemap.maps.categoriesCacheExpireTimestamp = 0;
	}
	sitemap.maps.topics.forEach((topicMap) => {
		topicMap.cacheExpireTimestamp = 0;
	});
};

require('./promisify')(sitemap);
