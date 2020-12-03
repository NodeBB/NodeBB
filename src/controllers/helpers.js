'use strict';

const colors = require('colors/safe');
const nconf = require('nconf');
const validator = require('validator');
const querystring = require('querystring');
const _ = require('lodash');

const user = require('../user');
const privileges = require('../privileges');
const categories = require('../categories');
const plugins = require('../plugins');
const meta = require('../meta');
const middleware = require('../middleware');

const helpers = module.exports;

const relative_path = nconf.get('relative_path');
const url = nconf.get('url');

helpers.noScriptErrors = async function (req, res, error, httpStatus) {
	if (req.body.noscript !== 'true') {
		return res.status(httpStatus).send(error);
	}

	const httpStatusString = httpStatus.toString();
	await middleware.buildHeaderAsync(req, res);
	res.status(httpStatus).render(httpStatusString, {
		path: req.path,
		loggedIn: req.loggedIn,
		error: error,
		returnLink: true,
		title: '[[global:' + httpStatusString + '.title]]',
	});
};

helpers.terms = {
	daily: 'day',
	weekly: 'week',
	monthly: 'month',
};

helpers.buildQueryString = function (query, key, value) {
	const queryObj = { ...query };
	if (value) {
		queryObj[key] = value;
	} else {
		delete queryObj[key];
	}
	delete queryObj._;
	return Object.keys(queryObj).length ? '?' + querystring.stringify(queryObj) : '';
};

helpers.addLinkTags = function (params) {
	params.res.locals.linkTags = params.res.locals.linkTags || [];
	params.res.locals.linkTags.push({
		rel: 'canonical',
		href: url + '/' + params.url,
	});

	params.tags.forEach(function (rel) {
		rel.href = url + '/' + params.url + rel.href;
		params.res.locals.linkTags.push(rel);
	});
};

helpers.buildFilters = function (url, filter, query) {
	return [{
		name: '[[unread:all-topics]]',
		url: url + helpers.buildQueryString(query, 'filter', ''),
		selected: filter === '',
		filter: '',
		icon: 'fa-book',
	}, {
		name: '[[unread:new-topics]]',
		url: url + helpers.buildQueryString(query, 'filter', 'new'),
		selected: filter === 'new',
		filter: 'new',
		icon: 'fa-clock-o',
	}, {
		name: '[[unread:watched-topics]]',
		url: url + helpers.buildQueryString(query, 'filter', 'watched'),
		selected: filter === 'watched',
		filter: 'watched',
		icon: 'fa-bell-o',
	}, {
		name: '[[unread:unreplied-topics]]',
		url: url + helpers.buildQueryString(query, 'filter', 'unreplied'),
		selected: filter === 'unreplied',
		filter: 'unreplied',
		icon: 'fa-reply',
	}];
};

helpers.buildTerms = function (url, term, query) {
	return [{
		name: '[[recent:alltime]]',
		url: url + helpers.buildQueryString(query, 'term', ''),
		selected: term === 'alltime',
		term: 'alltime',
	}, {
		name: '[[recent:day]]',
		url: url + helpers.buildQueryString(query, 'term', 'daily'),
		selected: term === 'day',
		term: 'day',
	}, {
		name: '[[recent:week]]',
		url: url + helpers.buildQueryString(query, 'term', 'weekly'),
		selected: term === 'week',
		term: 'week',
	}, {
		name: '[[recent:month]]',
		url: url + helpers.buildQueryString(query, 'term', 'monthly'),
		selected: term === 'month',
		term: 'month',
	}];
};

helpers.notAllowed = async function (req, res, error) {
	const data = await plugins.hooks.fire('filter:helpers.notAllowed', {
		req: req,
		res: res,
		error: error,
	});

	if (req.loggedIn || req.uid === -1) {
		if (res.locals.isAPI) {
			helpers.formatApiResponse(403, res, error);
		} else {
			await middleware.buildHeaderAsync(req, res);
			res.status(403).render('403', {
				path: req.path,
				loggedIn: req.loggedIn,
				error: data.error,
				title: '[[global:403.title]]',
			});
		}
	} else if (res.locals.isAPI) {
		req.session.returnTo = req.url.replace(/^\/api/, '');
		helpers.formatApiResponse(401, res, error);
	} else {
		req.session.returnTo = req.url;
		res.redirect(relative_path + '/login');
	}
};

helpers.redirect = function (res, url, permanent) {
	// this is used by sso plugins to redirect to the auth route
	// { external: '/auth/sso' } or { external: 'https://domain/auth/sso' }
	if (url.hasOwnProperty('external')) {
		const redirectUrl = encodeURI(prependRelativePath(url.external));
		if (res.locals.isAPI) {
			res.set('X-Redirect', redirectUrl).status(200).json({ external: redirectUrl });
		} else {
			res.redirect(permanent ? 308 : 307, redirectUrl);
		}
		return;
	}

	if (res.locals.isAPI) {
		url = encodeURI(url);
		res.set('X-Redirect', url).status(200).json(url);
	} else {
		res.redirect(permanent ? 308 : 307, encodeURI(prependRelativePath(url)));
	}
};

function prependRelativePath(url) {
	return url.startsWith('http://') || url.startsWith('https://') ?
		url : relative_path + url;
}

helpers.buildCategoryBreadcrumbs = async function (cid) {
	const breadcrumbs = [];

	while (parseInt(cid, 10)) {
		/* eslint-disable no-await-in-loop */
		const data = await categories.getCategoryFields(cid, ['name', 'slug', 'parentCid', 'disabled', 'isSection']);
		if (!data.disabled && !data.isSection) {
			breadcrumbs.unshift({
				text: String(data.name),
				url: relative_path + '/category/' + data.slug,
				cid: cid,
			});
		}
		cid = data.parentCid;
	}
	if (meta.config.homePageRoute && meta.config.homePageRoute !== 'categories') {
		breadcrumbs.unshift({
			text: '[[global:header.categories]]',
			url: relative_path + '/categories',
		});
	}

	breadcrumbs.unshift({
		text: '[[global:home]]',
		url: relative_path + '/',
	});

	return breadcrumbs;
};

helpers.buildBreadcrumbs = function (crumbs) {
	const breadcrumbs = [
		{
			text: '[[global:home]]',
			url: relative_path + '/',
		},
	];

	crumbs.forEach(function (crumb) {
		if (crumb) {
			if (crumb.url) {
				crumb.url = relative_path + crumb.url;
			}
			breadcrumbs.push(crumb);
		}
	});

	return breadcrumbs;
};

helpers.buildTitle = function (pageTitle) {
	const titleLayout = meta.config.titleLayout || '{pageTitle} | {browserTitle}';

	const browserTitle = validator.escape(String(meta.config.browserTitle || meta.config.title || 'NodeBB'));
	pageTitle = pageTitle || '';
	const title = titleLayout.replace('{pageTitle}', () => pageTitle).replace('{browserTitle}', () => browserTitle);
	return title;
};

helpers.getCategories = async function (set, uid, privilege, selectedCid) {
	const cids = await categories.getCidsByPrivilege(set, uid, privilege);
	return await getCategoryData(cids, uid, selectedCid, privilege);
};

helpers.getCategoriesByStates = async function (uid, selectedCid, states, privilege = 'topics:read') {
	const cids = await categories.getAllCidsFromSet('categories:cid');
	return await getCategoryData(cids, uid, selectedCid, states, privilege);
};

async function getCategoryData(cids, uid, selectedCid, states, privilege) {
	if (selectedCid && !Array.isArray(selectedCid)) {
		selectedCid = [selectedCid];
	}
	selectedCid = selectedCid && selectedCid.map(String);
	states = states || [categories.watchStates.watching, categories.watchStates.notwatching];

	const [allowed, watchState, categoryData, isAdmin] = await Promise.all([
		privileges.categories.isUserAllowedTo(privilege, cids, uid),
		categories.getWatchState(cids, uid),
		categories.getCategoriesData(cids),
		user.isAdministrator(uid),
	]);

	categories.getTree(categoryData);

	const cidToAllowed = _.zipObject(cids, allowed.map(allowed => isAdmin || allowed));
	const cidToCategory = _.zipObject(cids, categoryData);
	const cidToWatchState = _.zipObject(cids, watchState);

	const visibleCategories = categoryData.filter(function (c) {
		const hasVisibleChildren = checkVisibleChildren(c, cidToAllowed, cidToWatchState, states);
		const isCategoryVisible = c && cidToAllowed[c.cid] && !c.link && !c.disabled && states.includes(cidToWatchState[c.cid]);
		const shouldBeRemoved = !hasVisibleChildren && !isCategoryVisible;
		const shouldBeDisaplayedAsDisabled = hasVisibleChildren && !isCategoryVisible;

		if (shouldBeDisaplayedAsDisabled) {
			c.disabledClass = true;
		}

		if (shouldBeRemoved && c && c.parent && c.parent.cid && cidToCategory[c.parent.cid]) {
			cidToCategory[c.parent.cid].children = cidToCategory[c.parent.cid].children.filter(child => child.cid !== c.cid);
		}

		return c && !shouldBeRemoved;
	});

	const categoriesData = categories.buildForSelectCategories(visibleCategories, ['disabledClass']);

	let selectedCategory = [];
	const selectedCids = [];
	categoriesData.forEach(function (category) {
		category.selected = selectedCid ? selectedCid.includes(String(category.cid)) : false;
		if (category.selected) {
			selectedCategory.push(category);
			selectedCids.push(category.cid);
		}
	});
	selectedCids.sort((a, b) => a - b);

	if (selectedCategory.length > 1) {
		selectedCategory = {
			icon: 'fa-plus',
			name: '[[unread:multiple-categories-selected]]',
			bgColor: '#ddd',
		};
	} else if (selectedCategory.length === 1) {
		selectedCategory = selectedCategory[0];
	} else {
		selectedCategory = null;
	}

	return {
		categories: categoriesData,
		selectedCategory: selectedCategory,
		selectedCids: selectedCids,
	};
}

function checkVisibleChildren(c, cidToAllowed, cidToWatchState, states) {
	if (!c || !Array.isArray(c.children)) {
		return false;
	}
	return c.children.some(c => c && !c.disabled && (
		(cidToAllowed[c.cid] && states.includes(cidToWatchState[c.cid])) || checkVisibleChildren(c, cidToAllowed, cidToWatchState, states)
	));
}

helpers.getHomePageRoutes = async function (uid) {
	let cids = await categories.getAllCidsFromSet('categories:cid');
	cids = await privileges.categories.filterCids('find', cids, uid);
	const categoryData = await categories.getCategoriesFields(cids, ['name', 'slug']);

	const categoryRoutes = categoryData.map(function (category) {
		return {
			route: 'category/' + category.slug,
			name: 'Category: ' + category.name,
		};
	});
	const routes = [
		{
			route: 'categories',
			name: 'Categories',
		},
		{
			route: 'unread',
			name: 'Unread',
		},
		{
			route: 'recent',
			name: 'Recent',
		},
		{
			route: 'top',
			name: 'Top',
		},
		{
			route: 'popular',
			name: 'Popular',
		},
	].concat(categoryRoutes, [
		{
			route: 'custom',
			name: 'Custom',
		},
	]);
	const data = await plugins.hooks.fire('filter:homepage.get', { routes: routes });
	return data.routes;
};

helpers.formatApiResponse = async (statusCode, res, payload) => {
	if (res.req.method === 'HEAD') {
		return res.sendStatus(statusCode);
	}

	if (String(statusCode).startsWith('2')) {
		res.status(statusCode).json({
			status: {
				code: 'ok',
				message: 'OK',
			},
			response: payload || {},
		});
	} else if (payload instanceof Error) {
		const message = payload.message;
		const response = {};

		// Update status code based on some common error codes
		switch (payload.message) {
			case '[[error:user-banned]]':
				Object.assign(response, await generateBannedResponse(res));
				// intentional fall through

			case '[[error:no-privileges]]':
				statusCode = 403;
				break;

			case '[[error:invalid-uid]]':
				statusCode = 401;
				break;
		}

		const returnPayload = helpers.generateError(statusCode, message);
		returnPayload.response = response;

		if (global.env === 'development') {
			returnPayload.stack = payload.stack;
			process.stdout.write(`[${colors.yellow('api')}] Exception caught, error with stack trace follows:\n`);
			process.stdout.write(payload.stack);
		}
		res.status(statusCode).json(returnPayload);
	} else if (!payload) {
		// Non-2xx statusCode, generate predefined error
		res.status(statusCode).json(helpers.generateError(statusCode));
	}
};

async function generateBannedResponse(res) {
	const response = {};
	const [reason, expiry] = await Promise.all([
		user.bans.getReason(res.req.uid),
		user.getUserField(res.req.uid, 'banned:expire'),
	]);

	response.reason = reason;
	if (expiry) {
		Object.assign(response, {
			expiry,
			expiryISO: new Date(expiry).toISOString(),
			expiryLocaleString: new Date(expiry).toLocaleString(),
		});
	}

	return response;
}

helpers.generateError = (statusCode, message) => {
	var payload = {
		status: {
			code: 'internal-server-error',
			message: 'An unexpected error was encountered while attempting to service your request.',
		},
		response: {},
	};

	// Need to turn all these into translation strings
	switch (statusCode) {
		case 400:
			payload.status.code = 'bad-request';
			payload.status.message = message || 'Something was wrong with the request payload you passed in.';
			break;

		case 401:
			payload.status.code = 'not-authorised';
			payload.status.message = message || 'A valid login session was not found. Please log in and try again.';
			break;

		case 403:
			payload.status.code = 'forbidden';
			payload.status.message = message || 'You are not authorised to make this call';
			break;

		case 404:
			payload.status.code = 'not-found';
			payload.status.message = message || 'Invalid API call';
			break;

		case 426:
			payload.status.code = 'upgrade-required';
			payload.status.message = message || 'HTTPS is required for requests to the write api, please re-send your request via HTTPS';
			break;

		case 500:
			payload.status.code = 'internal-server-error';
			payload.status.message = message || payload.status.message;
			break;

		case 501:
			payload.status.code = 'not-implemented';
			payload.status.message = message || 'The route you are trying to call is not implemented yet, please try again tomorrow';
			break;
	}

	return payload;
};

require('../promisify')(helpers);
