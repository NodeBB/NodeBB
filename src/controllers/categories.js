"use strict";


var async = require('async');
var nconf = require('nconf');
var validator = require('validator');

var categories = require('../categories');
var meta = require('../meta');
var plugins = require('../plugins');

var helpers = require('./helpers');

var categoriesController = {};

categoriesController.list = function(req, res, next) {
	res.locals.metaTags = [{
		name: "title",
		content: validator.escape(meta.config.title || 'NodeBB')
	}, {
		name: "description",
		content: validator.escape(meta.config.description || '')
	}, {
		property: 'og:title',
		content: '[[pages:categories]]'
	}, {
		property: 'og:type',
		content: 'website'
	}];

	if (meta.config['brand:logo']) {
		var brandLogo = meta.config['brand:logo'];
		if (!brandLogo.startsWith('http')) {
			brandLogo = nconf.get('url') + brandLogo;
		}
		res.locals.metaTags.push({
			property: 'og:image',
			content: brandLogo
		});
	}

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
		function (next) {
			var data = {
				title: '[[pages:categories]]',
				categories: categoryData
			};

			if (req.path.startsWith('/api/categories') || req.path.startsWith('/categories')) {
				data.breadcrumbs = helpers.buildBreadcrumbs([{text: data.title}]);
			}

			data.categories.forEach(function(category) {
				if (category && Array.isArray(category.posts) && category.posts.length) {
					category.teaser = {
						url: nconf.get('relative_path') + '/topic/' + category.posts[0].topic.slug + '/' + category.posts[0].index,
						timestampISO: category.posts[0].timestampISO
					};
				}
			});

			plugins.fireHook('filter:categories.build', {req: req, res: res, templateData: data}, next);
		}
	], function(err, data) {
		if (err) {
			return next(err);
		}
		res.render('categories', data.templateData);
	});
};

module.exports = categoriesController;
