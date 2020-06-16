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
	let validFilters = ['assignee', 'state', 'reporterId', 'type', 'targetUid', 'cid', 'quick', 'page', 'perPage'];

	// Reset filters if explicitly requested
	if (parseInt(req.query.reset, 10) === 1) {
		delete req.session.flags_filters;
	}

	const [isAdminOrGlobalMod, moderatedCids, data] = await Promise.all([
		user.isAdminOrGlobalMod(req.uid),
		user.getModeratedCids(req.uid),
		plugins.fireHook('filter:flags.validateFilters', { filters: validFilters }),
	]);

	if (!(isAdminOrGlobalMod || !!moderatedCids.length)) {
		return next(new Error('[[error:no-privileges]]'));
	}

	if (!isAdminOrGlobalMod && moderatedCids.length) {
		res.locals.cids = moderatedCids;
	}

	validFilters = data.filters;

	// Parse query string params for filters
	let filters = validFilters.reduce(function (memo, cur) {
		if (req.query.hasOwnProperty(cur)) {
			memo[cur] = req.query[cur];
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

	// Save filters into session unless removed
	req.session.flags_filters = filters;

	const [flagsData, analyticsData, categoriesData] = await Promise.all([
		flags.list(filters, req.uid),
		analytics.getDailyStatsForSet('analytics:flags', Date.now(), 30),
		categories.buildForSelect(req.uid, 'read'),
	]);

	res.render('flags/list', {
		flags: flagsData.flags,
		analytics: analyticsData,
		categories: filterCategories(res.locals.cids, categoriesData),
		hasFilter: hasFilter,
		filters: filters,
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
		filters: req.session.flags_filters || [],
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

	const page = parseInt(req.query.page, 10) || 1;
	const postsPerPage = 20;

	const [ids, isAdminOrGlobalMod, moderatedCids] = await Promise.all([
		db.getSortedSetRange('post:queue', 0, -1),
		user.isAdminOrGlobalMod(req.uid),
		user.getModeratedCids(req.uid),
	]);

	let postData = await getQueuedPosts(ids);
	postData = postData.filter(p => p && (isAdminOrGlobalMod || moderatedCids.includes(String(p.category.cid))));

	const pageCount = Math.max(1, Math.ceil(postData.length / postsPerPage));
	const start = (page - 1) * postsPerPage;
	const stop = start + postsPerPage - 1;
	postData = postData.slice(start, stop + 1);

	res.render('admin/manage/post-queue', {
		title: '[[pages:post-queue]]',
		posts: postData,
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
		postData.topic = { cid: postData.data.cid };
	} else if (postData.data.tid) {
		postData.topic = await topics.getTopicFields(postData.data.tid, ['title', 'cid']);
	}
	postData.category = await categories.getCategoryData(postData.topic.cid);
	const result = await plugins.fireHook('filter:parse.post', { postData: postData.data });
	postData.data.content = result.postData.content;
}
