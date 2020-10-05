'use strict';

const validator = require('validator');

const db = require('../database');
const user = require('../user');
const topics = require('../topics');
const categories = require('../categories');
const flags = require('../flags');
const analytics = require('../analytics');
const plugins = require('../plugins');
const pagination = require('../pagination');
const privileges = require('../privileges');
const utils = require('../utils');
const helpers = require('./helpers');

const modsController = module.exports;
modsController.flags = {};

modsController.flags.list = async function (req, res, next) {
	const validFilters = ['assignee', 'state', 'reporterId', 'type', 'targetUid', 'cid', 'quick', 'page', 'perPage'];
	const validSorts = ['newest', 'oldest', 'reports', 'upvotes', 'downvotes', 'replies'];

	// Reset filters if explicitly requested
	if (parseInt(req.query.reset, 10) === 1) {
		delete req.session.flags_filters;
		delete req.session.flags_sort;
	}

	const results = await Promise.all([
		user.isAdminOrGlobalMod(req.uid),
		user.getModeratedCids(req.uid),
		plugins.fireHook('filter:flags.validateFilters', { filters: validFilters }),
		plugins.fireHook('filter:flags.validateSort', { sorts: validSorts }),
	]);
	const [isAdminOrGlobalMod, moderatedCids,, { sorts }] = results;
	let [,, { filters }] = results;

	if (!(isAdminOrGlobalMod || !!moderatedCids.length)) {
		return next(new Error('[[error:no-privileges]]'));
	}

	if (!isAdminOrGlobalMod && moderatedCids.length) {
		res.locals.cids = moderatedCids;
	}

	// Parse query string params for filters, eliminate non-valid filters
	filters = filters.reduce(function (memo, cur) {
		if (req.query.hasOwnProperty(cur)) {
			if (req.query[cur] === '') {
				delete req.session.flags_filters[cur];
			} else {
				memo[cur] = req.query[cur];
			}
		}

		return memo;
	}, {});
	let hasFilter = !!Object.keys(filters).length;

	if (!hasFilter && req.session.hasOwnProperty('flags_filters')) {
		// Load filters from session object
		filters = req.session.flags_filters;
		hasFilter = true;
	}

	if (res.locals.cids) {
		if (!filters.cid) {
			// If mod and no cid filter, add filter for their modded categories
			filters.cid = res.locals.cids;
		} else if (Array.isArray(filters.cid)) {
			// Remove cids they do not moderate
			filters.cid = filters.cid.filter(cid => res.locals.cids.includes(String(cid)));
		} else if (!res.locals.cids.includes(String(filters.cid))) {
			filters.cid = res.locals.cids;
			hasFilter = false;
		}
	}

	// Pagination doesn't count as a filter
	if (
		(Object.keys(filters).length === 1 && filters.hasOwnProperty('page')) ||
		(Object.keys(filters).length === 2 && filters.hasOwnProperty('page') && filters.hasOwnProperty('perPage'))
	) {
		hasFilter = false;
	}

	// Parse sort from query string
	let sort;
	if (!req.query.sort && req.session.hasOwnProperty('flags_sort')) {
		sort = req.session.flags_sort;
	} else {
		sort = sorts.includes(req.query.sort) ? req.query.sort : null;
	}
	if (sort === 'newest') {
		sort = undefined;
	}
	hasFilter = hasFilter || !!sort;

	// Save filters and sorting into session unless removed
	req.session.flags_filters = filters;
	req.session.flags_sort = sort;

	const [flagsData, analyticsData, categoriesData] = await Promise.all([
		flags.list({
			filters: filters,
			sort: sort,
			uid: req.uid,
		}),
		analytics.getDailyStatsForSet('analytics:flags', Date.now(), 30),
		categories.buildForSelect(req.uid, 'read'),
	]);

	res.render('flags/list', {
		flags: flagsData.flags,
		analytics: analyticsData,
		categories: filterCategories(res.locals.cids, categoriesData),
		hasFilter: hasFilter,
		filters: filters,
		sort: sort || 'newest',
		title: '[[pages:flags]]',
		pagination: pagination.create(flagsData.page, flagsData.pageCount, req.query),
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:flags]]' }]),
	});
};

modsController.flags.detail = async function (req, res, next) {
	const results = await utils.promiseParallel({
		isAdminOrGlobalMod: user.isAdminOrGlobalMod(req.uid),
		moderatedCids: user.getModeratedCids(req.uid),
		flagData: flags.get(req.params.flagId),
		assignees: user.getAdminsandGlobalModsandModerators(),
		categories: categories.buildForSelect(req.uid, 'read'),
		privileges: Promise.all(['global', 'admin'].map(async type => privileges[type].get(req.uid))),
	});
	results.privileges = { ...results.privileges[0], ...results.privileges[1] };

	if (!results.flagData) {
		return next(new Error('[[error:invalid-data]]'));
	} else if (!(results.isAdminOrGlobalMod || !!results.moderatedCids.length)) {
		return next(new Error('[[error:no-privileges]]'));
	}

	if (!results.isAdminOrGlobalMod && results.moderatedCids.length) {
		res.locals.cids = results.moderatedCids;
	}

	results.categories = filterCategories(res.locals.cids, results.categories);

	if (results.flagData.type === 'user') {
		results.flagData.type_path = 'uid';
	} else if (results.flagData.type === 'post') {
		results.flagData.type_path = 'post';
	}

	res.render('flags/detail', Object.assign(results.flagData, {
		assignees: results.assignees,
		type_bool: ['post', 'user', 'empty'].reduce(function (memo, cur) {
			if (cur !== 'empty') {
				memo[cur] = results.flagData.type === cur && (!results.flagData.target || !!Object.keys(results.flagData.target).length);
			} else {
				memo[cur] = !Object.keys(results.flagData.target).length;
			}

			return memo;
		}, {}),
		title: '[[pages:flag-details, ' + req.params.flagId + ']]',
		categories: results.categories,
		filters: req.session.flags_filters || {},
		privileges: results.privileges,
		breadcrumbs: helpers.buildBreadcrumbs([
			{ text: '[[pages:flags]]', url: '/flags' },
			{ text: '[[pages:flag-details, ' + req.params.flagId + ']]' },
		]),
	}));
};

function filterCategories(moderatedCids, categories) {
	// If cids is populated, then slim down the categories list
	if (moderatedCids) {
		categories = categories.filter(category => moderatedCids.includes(String(category.cid)));
	}

	return categories.reduce(function (memo, cur) {
		if (!moderatedCids) {
			memo[cur.cid] = cur.name;
			return memo;
		}

		// If mod, remove categories they can't moderate
		if (moderatedCids.includes(String(cur.cid))) {
			memo[cur.cid] = cur.name;
		}

		return memo;
	}, {});
}

modsController.postQueue = async function (req, res, next) {
	// Admins, global mods, and individual mods only
	const isPrivileged = await user.isPrivileged(req.uid);
	if (!isPrivileged) {
		return next();
	}
	const cid = req.query.cid;
	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;

	const [ids, isAdminOrGlobalMod, moderatedCids, allCategories, categoriesData] = await Promise.all([
		db.getSortedSetRange('post:queue', 0, -1),
		user.isAdminOrGlobalMod(req.uid),
		user.getModeratedCids(req.uid),
		categories.buildForSelect(req.uid, 'find', ['disabled', 'link', 'slug']),
		helpers.getCategoriesByStates(req.uid, cid, null, 'moderate'),
	]);
	if (!moderatedCids.includes(String(cid)) && !isAdminOrGlobalMod) {
		return next();
	}
	allCategories.forEach((c) => {
		c.disabledClass = !isAdminOrGlobalMod && !moderatedCids.includes(String(c.cid));
	});

	let postData = await getQueuedPosts(ids);
	postData = postData.filter(p => p &&
		(!categoriesData.selectedCids.length || categoriesData.selectedCids.includes(p.category.cid)) &&
		(isAdminOrGlobalMod || moderatedCids.includes(String(p.category.cid))));

	({ posts: postData } = await plugins.fireHook('filter:post-queue.get', {
		posts: postData,
		req: req,
	}));

	const pageCount = Math.max(1, Math.ceil(postData.length / postsPerPage));
	const start = (page - 1) * postsPerPage;
	const stop = start + postsPerPage - 1;
	postData = postData.slice(start, stop + 1);

	res.render('post-queue', {
		title: '[[pages:post-queue]]',
		posts: postData,
		allCategories: allCategories,
		...categoriesData,
		allCategoriesUrl: 'post-queue' + helpers.buildQueryString(req.query, 'cid', ''),
		pagination: pagination.create(page, pageCount),
		breadcrumbs: helpers.buildBreadcrumbs([{ text: '[[pages:post-queue]]' }]),
	});
};

async function getQueuedPosts(ids) {
	const keys = ids.map(id => 'post:queue:' + id);
	const postData = await db.getObjects(keys);
	postData.forEach(function (data) {
		if (data) {
			data.data = JSON.parse(data.data);
			data.data.timestampISO = utils.toISOString(data.data.timestamp);
		}
	});
	const uids = postData.map(data => data && data.uid);
	const userData = await user.getUsersFields(uids, ['username', 'userslug', 'picture']);
	postData.forEach(function (postData, index) {
		if (postData) {
			postData.user = userData[index];
			postData.data.rawContent = validator.escape(String(postData.data.content));
			postData.data.title = validator.escape(String(postData.data.title || ''));
		}
	});

	await Promise.all(postData.map(p => addMetaData(p)));
	return postData;
}

async function addMetaData(postData) {
	if (!postData) {
		return;
	}
	postData.topic = { cid: 0 };
	if (postData.data.cid) {
		postData.topic = { cid: parseInt(postData.data.cid, 10) };
	} else if (postData.data.tid) {
		postData.topic = await topics.getTopicFields(postData.data.tid, ['title', 'cid']);
	}
	postData.category = await categories.getCategoryData(postData.topic.cid);
	const result = await plugins.fireHook('filter:parse.post', { postData: postData.data });
	postData.data.content = result.postData.content;
}
