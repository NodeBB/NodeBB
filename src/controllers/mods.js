'use strict';

const user = require('../user');
const categories = require('../categories');
const flags = require('../flags');
const analytics = require('../analytics');
const plugins = require('../plugins');
const pagination = require('../pagination');
const utils = require('../utils');

const adminPostQueueController = require('./admin/postqueue');
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
	if (Object.keys(filters).length === 2 && filters.hasOwnProperty('page') && filters.hasOwnProperty('perPage')) {
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
	});
};

modsController.flags.detail = async function (req, res, next) {
	const results = await utils.promiseParallel({
		isAdminOrGlobalMod: user.isAdminOrGlobalMod(req.uid),
		moderatedCids: user.getModeratedCids(req.uid),
		flagData: flags.get(req.params.flagId),
		assignees: user.getAdminsandGlobalModsandModerators(),
		categories: categories.buildForSelect(req.uid, 'read'),
	});

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
	const isPrivileged = await user.isPrivileged(req.uid);
	if (!isPrivileged) {
		return next();
	}
	await adminPostQueueController.get(req, res, next);
};
