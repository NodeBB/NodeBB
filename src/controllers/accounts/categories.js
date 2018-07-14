'use strict';

var async = require('async');

var user = require('../../user');
var categories = require('../../categories');
var accountHelpers = require('./helpers');

var categoriesController = {};


categoriesController.get = function (req, res, callback) {
	var userData;
	async.waterfall([
		function (next) {
			accountHelpers.getUserDataByUserSlug(req.params.userslug, req.uid, next);
		},
		function (_userData, next) {
			userData = _userData;
			if (!userData) {
				return callback();
			}

			async.parallel({
				ignored: function (next) {
					user.getIgnoredCategories(userData.uid, next);
				},
				all: function (next) {
					categories.getCategoriesByPrivilege('cid:0:children', userData.uid, 'find', next);
				},
			}, next);
		},
		function (results, next) {
			flattenArray(results);
			userData.categories = results.all;
			next();
		},
	], function (err) {
		if (err) {
			return callback(err);
		}

		userData.title = '[[pages:account/watched_categories]]';
		res.render('account/categories', userData);
	});
};

function moveChildrenToRoot(child) {
	this.results.all.splice(this.i + this.results.j, 0, child);
	this.results.j = this.results.j + 1;
}

function flattenArray(results) {
	for (var i = 0; i < results.all.length; i++) {
		var category = results.all[i];

		category.isIgnored = false;
		if (results.ignored.includes(category.cid)) {
			category.isIgnored = true;
		}

		if (!!category.children && !!category.children.length) {
			results.j = 1;
			category.children.forEach(moveChildrenToRoot, { i: i, results: results });
			category.children = [];
		}
	}
}

module.exports = categoriesController;
