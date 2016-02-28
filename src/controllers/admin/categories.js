"use strict";

var async = require('async'),
	
	categories = require('../../categories'),
	privileges = require('../../privileges'),
	analytics = require('../../analytics'),
	plugins = require('../../plugins');


var categoriesController = {};

categoriesController.get = function(req, res, next) {
	async.parallel({
		category: async.apply(categories.getCategories, [req.params.category_id], req.user.uid),
		privileges: async.apply(privileges.categories.list, req.params.category_id),
		analytics: async.apply(analytics.getCategoryAnalytics, req.params.category_id)
	}, function(err, data) {
		if (err) {
			return next(err);
		}

		plugins.fireHook('filter:admin.category.get', { req: req, res: res, category: data.category[0], privileges: data.privileges, analytics: data.analytics }, function(err, data) {
			if (err) {
				return next(err);
			}

			res.render('admin/manage/category', {
				category: data.category,
				privileges: data.privileges,
				analytics: data.analytics
			});
		});
	});
};

categoriesController.getAll = function(req, res, next) {
	//Categories list will be rendered on client side with recursion, etc.
	res.render('admin/manage/categories', {});
};


module.exports = categoriesController;
