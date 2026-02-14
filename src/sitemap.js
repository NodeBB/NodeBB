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
	const [topicCount, categories, pages] = await Promise.all([
		db.getObjectField('global', 'topicCount'),
		getSitemapCategories(),
		getSitemapPages(),
	]);
	returnData.categories = categories.length > 0;
	returnData.pages = pages.length > 0;
	const numPages = Math.ceil(Math.max(0, topicCount / topicsPerPage));
	for (let x = 1; x <= numPages; x += 1) {
		returnData.topics.push(x);
	}

	return returnData;
};

async function getSitemapPages() {
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
	return data.urls;
}

sitemap.getPages = async function () {
	if (sitemap.maps.pages && Date.now() < sitemap.maps.pagesCacheExpireTimestamp) {
		return sitemap.maps.pages;
	}

	const urls = await getSitemapPages();
	if (!urls.length) {
		sitemap.maps.pages = '';
		sitemap.maps.pagesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
		return sitemap.maps.pages;
	}

	sitemap.maps.pages = await urlsToSitemap(urls);
	sitemap.maps.pagesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
	return sitemap.maps.pages;
};

async function getSitemapCategories() {
	const cids = await categories.getCidsByPrivilege('categories:cid', 0, 'find');
	const categoryData = await categories.getCategoriesFields(cids, ['slug']);
	const data = await plugins.hooks.fire('filter:sitemap.getCategories', {
		categories: categoryData,
	});
	return data.categories;
}

sitemap.getCategories = async function () {
	if (sitemap.maps.categories && Date.now() < sitemap.maps.categoriesCacheExpireTimestamp) {
		return sitemap.maps.categories;
	}

	const categoryUrls = [];
	const categoriesData = await getSitemapCategories();
	categoriesData.forEach((category) => {
		if (category) {
			categoryUrls.push({
				url: `${nconf.get('relative_path')}/category/${category.slug}`,
				changefreq: 'weekly',
				priority: 0.4,
			});
		}
	});

	if (!categoryUrls.length) {
		sitemap.maps.categories = '';
		sitemap.maps.categoriesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
		return sitemap.maps.categories;
	}

	sitemap.maps.categories = await urlsToSitemap(categoryUrls);
	sitemap.maps.categoriesCacheExpireTimestamp = Date.now() + (1000 * 60 * 60 * 24);
	return sitemap.maps.categories;
};

sitemap.getTopicPage = async function (page) {
	if (parseInt(page, 10) <= 0) {
		return;
	}

	const numTopics = meta.config.sitemapTopics;
	const start = (parseInt(page, 10) - 1) * numTopics;
	const stop = start + numTopics - 1;

	if (sitemap.maps.topics[page - 1] && Date.now() < sitemap.maps.topics[page - 1].cacheExpireTimestamp) {
		return sitemap.maps.topics[page - 1].sm;
	}

	const topicUrls = [];
	let tids = await db.getSortedSetRange('topics:tid', start, stop);
	tids = await privileges.topics.filterTids('topics:read', tids, 0);
	const topicData = await topics.getTopicsFields(tids, ['tid', 'title', 'slug', 'lastposttime']);

	const data = await plugins.hooks.fire('filter:sitemap.getCategories', {
		page: page,
		topics: topicData,
	});

	if (!data.topics.length) {
		sitemap.maps.topics[page - 1] = {
			sm: '',
			cacheExpireTimestamp: Date.now() + (1000 * 60 * 60 * 24),
		};
		return sitemap.maps.topics[page - 1].sm;
	}

	data.topics.forEach((topic) => {
		if (topic) {
			topicUrls.push({
				url: `${nconf.get('relative_path')}/topic/${topic.slug}`,
				lastmodISO: utils.toISOString(topic.lastposttime),
				changefreq: 'daily',
				priority: 0.6,
			});
		}
	});

	sitemap.maps.topics[page - 1] = {
		sm: await urlsToSitemap(topicUrls),
		cacheExpireTimestamp: Date.now() + (1000 * 60 * 60 * 24),
	};

	return sitemap.maps.topics[page - 1].sm;
};

async function urlsToSitemap(urls) {
	if (!urls.length) {
		return '';
	}
	const smStream = new SitemapStream({ hostname: nconf.get('url') });
	urls.forEach(url => smStream.write(url));
	smStream.end();
	return (await streamToPromise(smStream)).toString();
}

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
