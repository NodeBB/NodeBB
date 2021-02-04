'use strict';

const user = require('../../user');
const categories = require('../../categories');
const accountHelpers = require('./helpers');
const helpers = require('../helpers');
const pagination = require('../../pagination');
const meta = require('../../meta');

const categoriesController = module.exports;

categoriesController.get = async function (req, res, next) {
	const userData = await accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid);
	if (!userData) {
		return next();
	}
	const [states, allCategoriesData] = await Promise.all([
		user.getCategoryWatchState(userData.uid),
		categories.buildForSelect(userData.uid, 'find', ['descriptionParsed', 'depth', 'slug']),
	]);

	const pageCount = Math.max(1, Math.ceil(allCategoriesData.length / meta.config.categoriesPerPage));
	const page = Math.min(parseInt(req.query.page, 10) || 1, pageCount);
	const start = Math.max(0, (page - 1) * meta.config.categoriesPerPage);
	const stop = start + meta.config.categoriesPerPage - 1;
	const categoriesData = allCategoriesData.slice(start, stop + 1);


	categoriesData.forEach((category) => {
		if (category) {
			category.isIgnored = states[category.cid] === categories.watchStates.ignoring;
			category.isWatched = states[category.cid] === categories.watchStates.watching;
			category.isNotWatched = states[category.cid] === categories.watchStates.notwatching;
		}
	});
	userData.categories = categoriesData;
	userData.title = `[[pages:account/watched_categories, ${userData.username}]]`;
	userData.breadcrumbs = helpers.buildBreadcrumbs([
		{ text: userData.username, url: `/user/${userData.userslug}` },
		{ text: '[[pages:categories]]' },
	]);
	userData.pagination = pagination.create(page, pageCount, req.query);
	res.render('account/categories', userData);
};
