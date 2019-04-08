'use strict';

var async = require('async');

var categories = require('../../categories');
var analytics = require('../../analytics');
var plugins = require('../../plugins');
var translator = require('../../translator');

var categoriesController = module.exports;

categoriesController.get = function (req, res, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				category: async.apply(categories.getCategories, [req.params.category_id], req.uid),
				parent: async.apply(categories.getParents, [req.params.category_id]),
				allCategories: function (next) {
					async.waterfall([
						function (next) {
							categories.getAllCidsFromSet('categories:cid', next);
						},
						function (cids, next) {
							categories.getCategories(cids, req.uid, next);
						},
						function (categoryData, next) {
							categoryData = categories.getTree(categoryData);
							categories.buildForSelectCategories(categoryData, next);
						},
					], next);
				},
			}, next);
		},
		function (data, next) {
			var category = data.category[0];

			if (!category) {
				return callback();
			}
			category.parent = data.parent[0];
			data.allCategories.forEach(function (category) {
				if (category) {
					category.selected = parseInt(category.cid, 10) === parseInt(req.params.category_id, 10);
				}
			});

			plugins.fireHook('filter:admin.category.get', {
				req: req,
				res: res,
				category: category,
				customClasses: [],
				allCategories: data.allCategories,
			}, next);
		},
		function (data) {
			data.category.name = translator.escape(String(data.category.name));

			res.render('admin/manage/category', {
				category: data.category,
				allCategories: data.allCategories,
				customClasses: data.customClasses,
			});
		},
	], callback);
};

categoriesController.getAll = function (req, res) {
	// Categories list will be rendered on client side with recursion, etc.
	res.render('admin/manage/categories', {});
};

categoriesController.getAnalytics = function (req, res, next) {
	async.waterfall([
		function (next) {
			async.parallel({
				name: async.apply(categories.getCategoryField, req.params.category_id, 'name'),
				analytics: async.apply(analytics.getCategoryAnalytics, req.params.category_id),
			}, next);
		},
		function (data) {
			res.render('admin/manage/category-analytics', data);
		},
	], next);
};
