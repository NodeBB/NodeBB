'use strict';

const categories = require('../../categories');
const analytics = require('../../analytics');
const plugins = require('../../plugins');
const translator = require('../../translator');

const categoriesController = module.exports;

categoriesController.get = async function (req, res, next) {
	const [categoryData, parent, allCategories] = await Promise.all([
		categories.getCategories([req.params.category_id], req.uid),
		categories.getParents([req.params.category_id]),
		categories.buildForSelectAll(['text', 'value']),
	]);

	const category = categoryData[0];
	if (!category) {
		return next();
	}

	category.parent = parent[0];
	allCategories.forEach(function (category) {
		if (category) {
			category.selected = parseInt(category.value, 10) === parseInt(req.params.category_id, 10);
		}
	});

	const data = await plugins.fireHook('filter:admin.category.get', {
		req: req,
		res: res,
		category: category,
		customClasses: [],
		allCategories: allCategories,
	});
	data.category.name = translator.escape(String(data.category.name));
	data.category.description = translator.escape(String(data.category.description));

	res.render('admin/manage/category', {
		category: data.category,
		allCategories: data.allCategories,
		customClasses: data.customClasses,
	});
};

categoriesController.getAll = function (req, res) {
	// Categories list will be rendered on client side with recursion, etc.
	res.render('admin/manage/categories', {});
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
