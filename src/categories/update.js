
'use strict';

var async = require('async'),
	db = require('../database'),
	utils = require('../../public/src/utils');


module.exports = function(Categories) {

	Categories.update = function(modified, callback) {

		function updateCategory(cid, next) {
			var category = modified[cid];
			var fields = Object.keys(category);

			async.each(fields, function(key, next) {
				updateCategoryField(cid, key, category[key], next);
			}, next);
		}

		function updateCategoryField(cid, key, value, next) {
			db.setObjectField('category:' + cid, key, value, function(err) {
				if(err) {
					return next(err);
				}

				if (key === 'name') {
					var slug = cid + '/' + utils.slugify(value);
					db.setObjectField('category:' + cid, 'slug', slug, next);
				} else if (key === 'order') {
					db.sortedSetAdd('categories:cid', value, cid, next);
				} else {
					next();
				}
			});
		}

		var cids = Object.keys(modified);

		async.each(cids, updateCategory, function(err) {
			callback(err, cids);
		});
	};

};
