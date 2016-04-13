"use strict";

var async = require('async');

var categories = require('../../categories');
var privileges = require('../../privileges');
var analytics = require('../../analytics');
var plugins = require('../../plugins');
var translator = require('../../../public/src/modules/translator');


var categoriesController = {};

categoriesController.get = function(req, res, next) {
	async.parallel({
		category: async.apply(categories.getCategories, [req.params.category_id], req.user.uid),
		privileges: async.apply(privileges.categories.list, req.params.category_id)
	}, function(err, data) {
		if (err) {
			return next(err);
		}
		var category = data.category[0];

		if (!category) {
			return next();
		}

		plugins.fireHook('filter:admin.category.get', { req: req, res: res, category: category, privileges: data.privileges }, function(err, data) {
			if (err) {
				return next(err);
			}
			data.category.name = translator.escape(String(data.category.name));
			res.render('admin/manage/category', {
				category: data.category,
				privileges: data.privileges
			});
		});
	});
};

categoriesController.getAll = function(req, res, next) {
	// Categories list will be rendered on client side with recursion, etc.
	res.render('admin/manage/categories', {});
};

categoriesController.getAnalytics = function(req, res, next) {
	async.parallel({
		name: async.apply(categories.getCategoryField, req.params.category_id, 'name'),
		analytics: async.apply(analytics.getCategoryAnalytics, req.params.category_id)
	}, function(err, data) {
		res.render('admin/manage/category-analytics', data);
	});
};


module.exports = categoriesController;
