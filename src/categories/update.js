
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
		if (key === 'parentCid') {
			return updateParent(cid, value, callback);
		}

		db.setObjectField('category:' + cid, key, value, function(err) {
			if (err) {
				return callback(err);
			}

			if (key === 'order') {
				updateOrder(cid, value, callback);
			} else {
				callback();
			}
		});
	}

	function updateParent(cid, newParent, callback) {
		Categories.getCategoryField(cid, 'parentCid', function(err, oldParent) {
			if (err) {
				return callback(err);
			}

			async.series([
				function (next) {
					oldParent = parseInt(oldParent, 10) || 0;
					db.sortedSetRemove('cid:' + oldParent + ':children', cid, next);
				},
				function (next) {
					newParent = parseInt(newParent, 10) || 0;
					db.sortedSetAdd('cid:' + newParent + ':children', cid, cid, next);
				},
				function (next) {
					db.setObjectField('category:' + cid, 'parentCid', newParent, next);
				}
			], function(err, results) {
				callback(err);
			});
		});
	}

	function updateOrder(cid, order, callback) {
		Categories.getCategoryField(cid, 'parentCid', function(err, parentCid) {
			if (err) {
				return callback(err);
			}

			async.parallel([
				function (next) {
					db.sortedSetAdd('categories:cid', order, cid, next);
				},
				function (next) {
					parentCid = parseInt(parentCid, 10) || 0;
					db.sortedSetAdd('cid:' + parentCid + ':children', order, cid, next);
				}
			], callback);
		});
	}

};
