'use strict';

var async = require('async');

var categories = require('../../categories');
var privileges = require('../../privileges');

var privilegesController = module.exports;

privilegesController.get = function (req, res, callback) {
	var cid = req.params.cid ? parseInt(req.params.cid, 10) : 0;
	async.waterfall([
		function (next) {
			async.parallel({
				privileges: function (next) {
					if (!cid) {
						privileges.global.list(next);
					} else {
						privileges.categories.list(cid, next);
					}
				},
				categories: function (next) {
					async.waterfall([
						function (next) {
							categories.getAllCidsFromSet('categories:cid', next);
						},
						function (cids, next) {
							categories.getCategories(cids, req.uid, next);
						},
						function (categoriesData, next) {
							categoriesData = categories.getTree(categoriesData);
							categories.buildForSelectCategories(categoriesData, next);
						},
					], next);
				},
			}, next);
		},
		function (data) {
			data.categories.unshift({
				cid: 0,
				name: '[[admin/manage/privileges:global]]',
				icon: 'fa-list',
			});
			data.categories.forEach(function (category) {
				if (category) {
					category.selected = category.cid === cid;

					if (category.selected) {
						data.selected = category;
					}
				}
			});

			res.render('admin/manage/privileges', {
				privileges: data.privileges,
				categories: data.categories,
				selectedCategory: data.selected,
				cid: cid,
			});
		},
	], callback);
};
