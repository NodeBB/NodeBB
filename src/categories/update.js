
'use strict';

var async = require('async'),
	db = require('../database'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins');

module.exports = function(Categories) {

	Categories.update = function(modified, callback) {

		function updateCategory(cid, next) {
			Categories.exists(cid, function(err, exists) {
				if (err || !exists) {
					return next(err);
				}

				var modifiedFields = modified[cid];

				if (modifiedFields.hasOwnProperty('name')) {
					modifiedFields.slug = cid + '/' + utils.slugify(modifiedFields.name);
				}

				plugins.fireHook('filter:category.update', {category: modifiedFields}, function(err, categoryData) {
					if (err) {
						return next(err);
					}

					var category = categoryData.category;
					var fields = Object.keys(category);
					async.each(fields, function(key, next) {
						updateCategoryField(cid, key, category[key], next);
					}, function(err) {
						if (err) {
							return next(err);
						}
						plugins.fireHook('action:category.update', {cid: cid, modified: category});
						next();
					});
				});
			});
		}

		var cids = Object.keys(modified);

		async.each(cids, updateCategory, function(err) {
			callback(err, cids);
		});
	};

	function updateCategoryField(cid, key, value, callback) {
		db.setObjectField('category:' + cid, key, value, function(err) {
			if (err) {
				return callback(err);
			}

			if (key === 'order') {
				db.sortedSetAdd('categories:cid', value, cid, callback);
			} else {
				callback();
			}
		});
	}

};
