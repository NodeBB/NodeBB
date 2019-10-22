
'use strict';

const nconf = require('nconf');

const user = require('../user');
const categories = require('../categories');
const topics = require('../topics');
const meta = require('../meta');
const helpers = require('./helpers');
const pagination = require('../pagination');
const privileges = require('../privileges');

const recentController = module.exports;

recentController.get = async function (req, res, next) {
	const data = await recentController.getData(req, 'recent', 'recent');
	if (!data) {
		return next();
	}
	res.render('recent', data);
};

recentController.getData = async function (req, url, sort) {
	const page = parseInt(req.query.page, 10) || 1;
	let term = helpers.terms[req.query.term];
	const cid = req.query.cid;
	const filter = req.query.filter || '';

	if (!helpers.validFilters[filter] || (!term && req.query.term)) {
		return null;
	}
	term = term || 'alltime';

	const states = [categories.watchStates.watching, categories.watchStates.notwatching];
	if (filter === 'watched') {
		states.push(categories.watchStates.ignoring);
	}

	const [settings, categoryData, rssToken, canPost] = await Promise.all([
		user.getSettings(req.uid),
		helpers.getCategoriesByStates(req.uid, cid, states),
		user.auth.getFeedToken(req.uid),
		canPostTopic(req.uid),
	]);

	const start = Math.max(0, (page - 1) * settings.topicsPerPage);
	const stop = start + settings.topicsPerPage - 1;

	const data = await topics.getSortedTopics({
		cids: cid || categoryData.categories.map(c => c.cid),
		uid: req.uid,
		start: start,
		stop: stop,
		filter: filter,
		term: term,
		sort: sort,
		floatPinned: req.query.pinned,
		query: req.query,
	});

	data.canPost = canPost;
	data.categories = categoryData.categories;
	data.allCategoriesUrl = url + helpers.buildQueryString('', filter, '');
	data.selectedCategory = categoryData.selectedCategory;
	data.selectedCids = categoryData.selectedCids;
	data['feeds:disableRSS'] = meta.config['feeds:disableRSS'];
	data.rssFeedUrl = nconf.get('relative_path') + '/' + url + '.rss';
	if (req.loggedIn) {
		data.rssFeedUrl += '?uid=' + req.uid + '&token=' + rssToken;
	}
	data.title = meta.config.homePageTitle || '[[pages:home]]';

	data.filters = helpers.buildFilters(url, filter, req.query);
	data.selectedFilter = data.filters.find(filter => filter && filter.selected);
	data.terms = helpers.buildTerms(url, term, req.query);
	data.selectedTerm = data.terms.find(term => term && term.selected);

	var pageCount = Math.max(1, Math.ceil(data.topicCount / settings.topicsPerPage));
	data.pagination = pagination.create(page, pageCount, req.query);

	if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/' + url) || req.originalUrl.startsWith(nconf.get('relative_path') + '/' + url)) {
		data.title = '[[pages:' + url + ']]';
		data.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[' + url + ':title]]' }]);
	}

	return data;
};

async function canPostTopic(uid) {
	let cids = await categories.getAllCidsFromSet('categories:cid');
	cids = await privileges.categories.filterCids('topics:create', cids, uid);
	return cids.length > 0;
}

require('../promisify')(recentController, ['get']);
