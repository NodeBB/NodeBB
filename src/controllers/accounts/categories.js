'use strict';

const user = require('../../user');
const categories = require('../../categories');
const helpers = require('../helpers');
const pagination = require('../../pagination');
const meta = require('../../meta');

const categoriesController = module.exports;

categoriesController.get = async function (req, res) {
	const payload = res.locals.userData;
	const { username, userslug } = payload;
	const [states, allCategoriesData] = await Promise.all([
		user.getCategoryWatchState(res.locals.uid),
		categories.buildForSelect(res.locals.uid, 'find', ['descriptionParsed', 'depth', 'slug']),
	]);

	const pageCount = Math.max(1, Math.ceil(allCategoriesData.length / meta.config.categoriesPerPage));
	const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
	const start = Math.max(0, (page - 1) * meta.config.categoriesPerPage);
	const stop = start + meta.config.categoriesPerPage - 1;
	const categoriesData = allCategoriesData.slice(start, stop + 1);


	categoriesData.forEach((category) => {
		if (category) {
			category.isWatched = states[category.cid] === categories.watchStates.watching;
			category.isTracked = states[category.cid] === categories.watchStates.tracking;
			category.isNotWatched = states[category.cid] === categories.watchStates.notwatching;
			category.isIgnored = states[category.cid] === categories.watchStates.ignoring;
		}
	});

	payload.categories = categoriesData;
	payload.title = `[[pages:account/watched-categories, ${username}]]`;
	payload.breadcrumbs = helpers.buildBreadcrumbs([
		{ text: username, url: `/user/${userslug}` },
		{ text: '[[pages:categories]]' },
	]);
	payload.pagination = pagination.create(page, pageCount, req.query);
	res.render('account/categories', payload);
};
