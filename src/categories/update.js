
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

				plugins.fireHook('filter:category.update', modified[cid], function(err, category) {
					var fields = Object.keys(category);
					async.each(fields, function(key, next) {
						updateCategoryField(cid, key, category[key], next);
					}, next);
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

			if (key === 'name') {
				var slug = cid + '/' + utils.slugify(value);
				db.setObjectField('category:' + cid, 'slug', slug, callback);
			} else if (key === 'order') {
				db.sortedSetAdd('categories:cid', value, cid, callback);
			} else {
				callback();
			}
		});
	}

};
