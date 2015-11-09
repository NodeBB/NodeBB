'use strict';

var async = require('async');

var db = require('../../database');
var categories = require('../../categories');
var privileges = require('../../privileges');
var plugins = require('../../plugins');

var homePageController = {};


homePageController.get = function(req, res, next) {
	async.waterfall([
		function(next) {
			db.getSortedSetRange('categories:cid', 0, -1, next);
		},
		function(cids, next) {
			privileges.categories.filterCids('find', cids, 0, next);
		},
		function(cids, next) {
			categories.getCategoriesFields(cids, ['name', 'slug'], next);
		},
		function(categoryData, next) {
			categoryData = categoryData.map(function(category) {
				return {
					route: 'category/' + category.slug,
					name: 'Category: ' + category.name
				};
			});
			next(null, categoryData);
		}
	], function(err, categoryData) {
		if (err || !categoryData) {
			categoryData = [];
		}

		plugins.fireHook('filter:homepage.get', {routes: [
			{
				route: 'categories',
				name: 'Categories'
			},
			{
				route: 'recent',
				name: 'Recent'
			},
			{
				route: 'popular',
				name: 'Popular'
			}
		].concat(categoryData)}, function(err, data) {
			data.routes.push({
				route: '',
				name: 'Custom'
			});

			res.render('admin/general/homepage', data);
		});
	});
};

module.exports = homePageController;