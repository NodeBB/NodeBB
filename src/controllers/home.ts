'use strict';

const url = require('url');

import plugins from '../plugins';
import meta from '../meta';
import user from '../user';

function adminHomePageRoute() {
	return ((meta.configs.homePageRoute === 'custom' ? meta.configs.homePageCustom : meta.configs.homePageRoute) || 'categories').replace(/^\//, '');
}

async function getUserHomeRoute(uid: string) {
	const settings = await user.getSettings(uid);
	let route = adminHomePageRoute();

	if (settings.homePageRoute !== 'undefined' && settings.homePageRoute !== 'none') {
		route = (settings.homePageRoute || route).replace(/^\/+/, '');
	}

	return route;
}

export async function rewrite(req, res, next) {
	if (req.path !== '/' && req.path !== '/api/' && req.path !== '/api') {
		return next();
	}
	let route = adminHomePageRoute();
	if (meta.configs.allowUserHomePage) {
		route = await getUserHomeRoute(req.uid);
	}

	let parsedUrl;
	try {
		parsedUrl = url.parse(route, true);
	} catch (err: any) {
		return next(err);
	}

	const { pathname } = parsedUrl;
	const hook = `action:homepage.get:${pathname}`;
	if (!plugins.hooks.hasListeners(hook)) {
		req.url = req.path + (!req.path.endsWith('/') ? '/' : '') + pathname;
	} else {
		res.locals.homePageRoute = pathname;
	}
	req.query = Object.assign(parsedUrl.query, req.query);

	next();
}


export function pluginHook(req, res, next) {
	const hook = `action:homepage.get:${res.locals.homePageRoute}`;

	plugins.hooks.fire(hook, {
		req,
		res,
		next,
	});
}

