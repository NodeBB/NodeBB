
'use strict';

const validator = require('validator');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const search = require('../search');
const categories = require('../categories');
const user = require('../user');
const topics = require('../topics');
const pagination = require('../pagination');
const privileges = require('../privileges');
const translator = require('../translator');
const utils = require('../utils');
const helpers = require('./helpers');

const searchController = module.exports;

searchController.search = async function (req, res, next) {
	if (!plugins.hooks.hasListeners('filter:search.query')) {
		return next();
	}
	const page = Math.max(1, parseInt(req.query.page, 10)) || 1;

	const searchOnly = parseInt(req.query.searchOnly, 10) === 1;

	const userPrivileges = await utils.promiseParallel({
		'search:users': privileges.global.can('search:users', req.uid),
		'search:content': privileges.global.can('search:content', req.uid),
		'search:tags': privileges.global.can('search:tags', req.uid),
	});
	req.query.in = req.query.in || meta.config.searchDefaultIn || 'titlesposts';
	let allowed = (req.query.in === 'users' && userPrivileges['search:users']) ||
					(req.query.in === 'tags' && userPrivileges['search:tags']) ||
					(req.query.in === 'categories') ||
					(['titles', 'titlesposts', 'posts', 'bookmarks'].includes(req.query.in) && userPrivileges['search:content']);
	({ allowed } = await plugins.hooks.fire('filter:search.isAllowed', {
		uid: req.uid,
		query: req.query,
		allowed,
	}));
	if (!allowed) {
		return helpers.notAllowed(req, res);
	}

	if (req.query.categories && !Array.isArray(req.query.categories)) {
		req.query.categories = [req.query.categories];
	}
	if (req.query.hasTags && !Array.isArray(req.query.hasTags)) {
		req.query.hasTags = [req.query.hasTags];
	}

	const data = {
		query: req.query.term,
		searchIn: req.query.in,
		matchWords: req.query.matchWords || 'all',
		postedBy: req.query.by,
		categories: req.query.categories,
		searchChildren: req.query.searchChildren,
		hasTags: req.query.hasTags,
		replies: validator.escape(String(req.query.replies || '')),
		repliesFilter: validator.escape(String(req.query.repliesFilter || '')),
		timeRange: validator.escape(String(req.query.timeRange || '')),
		timeFilter: validator.escape(String(req.query.timeFilter || '')),
		sortBy: validator.escape(String(req.query.sortBy || '')) || meta.config.searchDefaultSortBy || '',
		sortDirection: validator.escape(String(req.query.sortDirection || '')),
		page: page,
		itemsPerPage: req.query.itemsPerPage,
		uid: req.uid,
		qs: req.query,
	};

	const [searchData] = await Promise.all([
		search.search(data),
		recordSearch(data),
	]);

	searchData.pagination = pagination.create(page, searchData.pageCount, req.query);
	searchData.multiplePages = searchData.pageCount > 1;
	searchData.search_query = validator.escape(String(req.query.term || ''));
	searchData.term = req.query.term;

	if (searchOnly) {
		return res.json(searchData);
	}


	searchData.breadcrumbs = helpers.buildBreadcrumbs([{ text: '[[global:search]]' }]);
	searchData.showAsPosts = !req.query.showAs || req.query.showAs === 'posts';
	searchData.showAsTopics = req.query.showAs === 'topics';
	searchData.title = '[[global:header.search]]';
	if (Array.isArray(data.categories)) {
		searchData.selectedCids = data.categories.map(cid => validator.escape(String(cid)));
		if (!searchData.selectedCids.includes('all') && searchData.selectedCids.length) {
			searchData.selectedCategory = { cid: 0 };
		}
	}

	searchData.filters = {
		replies: {
			active: !!data.repliesFilter,
			label: `[[search:replies-${data.repliesFilter}-count, ${data.replies}]]`,
		},
		time: {
			active: !!(data.timeFilter && data.timeRange),
			label: `[[search:time-${data.timeFilter}-than-${data.timeRange}]]`,
		},
		sort: {
			active: !!(data.sortBy && data.sortBy !== 'relevance'),
			label: `[[search:sort-by-${data.sortBy}-${data.sortDirection}]]`,
		},
		users: {
			active: !!(data.postedBy),
			label: translator.compile(
				'search:posted-by-usernames',
				(Array.isArray(data.postedBy) ? data.postedBy : [])
					.map(u => validator.escape(String(u))).join(', ')
			),
		},
		tags: {
			active: !!(Array.isArray(data.hasTags) && data.hasTags.length),
			label: translator.compile(
				'search:tags-x',
				(Array.isArray(data.hasTags) ? data.hasTags : [])
					.map(u => validator.escape(String(u))).join(', ')
			),
		},
		categories: {
			active: !!(Array.isArray(data.categories) && data.categories.length &&
				(data.categories.length > 1 || data.categories[0] !== 'all')),
			label: await buildSelectedCategoryLabel(searchData.selectedCids),
		},
	};

	searchData.userFilterSelected = await getSelectedUsers(data.postedBy);
	searchData.tagFilterSelected = getSelectedTags(data.hasTags);
	searchData.searchDefaultSortBy = meta.config.searchDefaultSortBy || '';
	searchData.searchDefaultIn = meta.config.searchDefaultIn || 'titlesposts';
	searchData.privileges = userPrivileges;

	res.render('search', searchData);
};

const searches = {};

async function recordSearch(data) {
	const { query, searchIn } = data;
	if (!query || parseInt(data.qs.composer, 10) === 1) {
		return;
	}
	const cleanedQuery = String(query).trim().toLowerCase().slice(0, 255);
	if (['titles', 'titlesposts', 'posts'].includes(searchIn) && cleanedQuery.length > 2) {
		searches[data.uid] = searches[data.uid] || { timeoutId: 0, queries: [] };
		searches[data.uid].queries.push(cleanedQuery);
		if (searches[data.uid].timeoutId) {
			clearTimeout(searches[data.uid].timeoutId);
		}
		searches[data.uid].timeoutId = setTimeout(async () => {
			if (searches[data.uid] && searches[data.uid].queries) {
				const copy = searches[data.uid].queries.slice();
				const filtered = searches[data.uid].queries.filter(
					q => !copy.find(query => query.startsWith(q) && query.length > q.length)
				);
				delete searches[data.uid];
				const dayTimestamp = (new Date());
				dayTimestamp.setHours(0, 0, 0, 0);
				await Promise.all(_.uniq(filtered).map(async (query) => {
					await db.sortedSetIncrBy('searches:all', 1, query);
					await db.sortedSetIncrBy(`searches:${dayTimestamp.getTime()}`, 1, query);
				}));
			}
		}, 5000);
	}
}

async function getSelectedUsers(postedBy) {
	if (!Array.isArray(postedBy) || !postedBy.length) {
		return [];
	}
	const uids = await user.getUidsByUsernames(postedBy);
	return await user.getUsersFields(uids, ['username', 'userslug', 'picture']);
}

function getSelectedTags(hasTags) {
	if (!Array.isArray(hasTags) || !hasTags.length) {
		return [];
	}
	const tags = hasTags.map(tag => ({ value: tag }));
	return topics.getTagData(tags);
}

async function buildSelectedCategoryLabel(selectedCids) {
	let label = '[[search:categories]]';
	if (Array.isArray(selectedCids)) {
		if (selectedCids.length > 1) {
			label = `[[search:categories-x, ${selectedCids.length}]]`;
		} else if (selectedCids.length === 1 && selectedCids[0] === 'watched') {
			label = `[[search:categories-watched-categories]]`;
		} else if (selectedCids.length === 1 && parseInt(selectedCids[0], 10)) {
			const categoryData = await categories.getCategoryData(selectedCids[0]);
			if (categoryData && categoryData.name) {
				label = `[[search:categories-x, ${categoryData.name}]]`;
			}
		}
	}
	return label;
}
