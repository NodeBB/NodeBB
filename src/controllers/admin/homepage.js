'use strict';

var async = require('async');

var categories = require('../../categories');
var privileges = require('../../privileges');
var plugins = require('../../plugins');

var homePageController = module.exports;

homePageController.get = function (req, res, next) {
	async.waterfall([
		function (next) {
			categories.getAllCidsFromSet('categories:cid', next);
		},
		function (cids, next) {
			privileges.categories.filterCids('find', cids, 0, next);
		},
		function (cids, next) {
			categories.getCategoriesFields(cids, ['name', 'slug'], next);
		},
		function (categoryData, next) {
			categoryData = categoryData.map(function (category) {
				return {
					route: 'category/' + category.slug,
					name: 'Category: ' + category.name,
				};
			});

			plugins.fireHook('filter:homepage.get', { routes: [
				{
					route: 'categories',
					name: 'Categories',
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
			].concat(categoryData) }, next);
		},
		function (data) {
			data.routes.push({
				route: '',
				name: 'Custom',
			});

			res.render('admin/general/homepage', data);
		},
	], next);
};
