'use strict';

var async = require('async');
var nconf = require('nconf');

var categories = require('../categories');
var meta = require('../meta');
var helpers = require('./helpers');

var categoriesController = module.exports;

categoriesController.list = function (req, res, next) {
	res.locals.metaTags = [{
		name: 'title',
		content: String(meta.config.title || 'NodeBB'),
	}, {
		property: 'og:type',
		content: 'website',
	}];

	var categoryData;
	async.waterfall([
		function (next) {
			categories.getCategoriesByPrivilege('cid:0:children', req.uid, 'find', next);
		},
		function (_categoryData, next) {
			categoryData = _categoryData;

			var allCategories = [];
			categories.flattenCategories(allCategories, categoryData);

			categories.getRecentTopicReplies(allCategories, req.uid, next);
		},
		function () {
			var data = {
				title: meta.config.homePageTitle || '[[pages:home]]',
				categories: categoryData,
			};

			if (req.originalUrl.startsWith(nconf.get('relative_path') + '/api/categories') || req.originalUrl.startsWith(nconf.get('relative_path') + '/categories')) {
				data.title = '[[pages:categories]]';
				data.breadcrumbs = helpers.buildBreadcrumbs([{ text: data.title }]);
				res.locals.metaTags.push({
					property: 'og:title',
					content: '[[pages:categories]]',
				});
			}

			data.categories.forEach(function (category) {
				if (category && Array.isArray(category.posts) && category.posts.length && category.posts[0]) {
					category.teaser = {
						url: nconf.get('relative_path') + '/post/' + category.posts[0].pid,
						timestampISO: category.posts[0].timestampISO,
						pid: category.posts[0].pid,
						topic: category.posts[0].topic,
					};
				}
			});

			res.render('categories', data);
		},
	], next);
};
