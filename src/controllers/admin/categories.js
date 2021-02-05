'use strict';

const categories = require('../../categories');
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const translator = require('../../translator');
const meta = require('../../meta');
const helpers = require('../helpers');

const categoriesController = module.exports;

categoriesController.get = async function (req, res, next) {
	const [categoryData, parent, selectedData] = await Promise.all([
		categories.getCategories([req.params.category_id], req.uid),
		categories.getParents([req.params.category_id]),
		helpers.getSelectedCategory(req.params.category_id),
	]);

	const category = categoryData[0];
	if (!category) {
		return next();
	}

	category.parent = parent[0];

	const data = await plugins.hooks.fire('filter:admin.category.get', {
		req: req,
		res: res,
		category: category,
		customClasses: [],
	});
	data.category.name = translator.escape(String(data.category.name));
	data.category.description = translator.escape(String(data.category.description));

	res.render('admin/manage/category', {
		category: data.category,
		selectedCategory: selectedData.selectedCategory,
		customClasses: data.customClasses,
		postQueueEnabled: !!meta.config.postQueue,
	});
};

categoriesController.getAll = async function (req, res) {
	// Categories list will be rendered on client side with recursion, etc.
	const cids = await categories.getAllCidsFromSet('categories:cid');
	const fields = [
		'cid', 'name', 'icon', 'parentCid', 'disabled', 'link',
		'color', 'bgColor', 'backgroundImage', 'imageClass',
	];
	const categoriesData = await categories.getCategoriesFields(cids, fields);
	const result = await plugins.hooks.fire('filter:admin.categories.get', { categories: categoriesData, fields: fields });
	const tree = categories.getTree(result.categories, 0);
	res.render('admin/manage/categories', {
		categories: tree,
	});
};

categoriesController.getAnalytics = async function (req, res) {
	const [name, analyticsData] = await Promise.all([
		categories.getCategoryField(req.params.category_id, 'name'),
		analytics.getCategoryAnalytics(req.params.category_id),
	]);
	res.render('admin/manage/category-analytics', {
		name: name,
		analytics: analyticsData,
	});
};
