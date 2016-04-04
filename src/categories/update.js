
'use strict';

var async = require('async'),
	db = require('../database'),
	utils = require('../../public/src/utils'),
	translator = require('../../public/src/modules/translator'),
	plugins = require('../plugins');

module.exports = function(Categories) {

	Categories.update = function(modified, callback) {

		var cids = Object.keys(modified);

		async.each(cids, function(cid, next) {
			updateCategory(cid, modified[cid], next);
		}, function(err) {
			callback(err, cids);
		});
	};

	function updateCategory(cid, modifiedFields, callback) {
		Categories.exists(cid, function(err, exists) {
			if (err || !exists) {
				return callback(err);
			}


			if (modifiedFields.hasOwnProperty('name')) {
				translator.translate(modifiedFields.name, function(translated) {
					modifiedFields.slug = cid + '/' + utils.slugify(translated);
				});
			}

			plugins.fireHook('filter:category.update', {category: modifiedFields}, function(err, categoryData) {
				if (err) {
					return callback(err);
				}

				var category = categoryData.category;
				var fields = Object.keys(category);
				// move parent to front, so its updated first
				var parentCidIndex = fields.indexOf('parentCid');
				if (parentCidIndex !== -1 && fields.length > 1) {
					fields.splice(0, 0, fields.splice(parentCidIndex, 1)[0]);
				}

				async.eachSeries(fields, function(key, next) {
					updateCategoryField(cid, key, category[key], next);
				}, function(err) {
					if (err) {
						return callback(err);
					}
					plugins.fireHook('action:category.update', {cid: cid, modified: category});
					callback();
				});
			});
		});
	}

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
			} else if (key === 'description') {
				Categories.parseDescription(cid, value, callback);
			} else {
				callback();
			}
		});
	}

	function updateParent(cid, newParent, callback) {
		if (parseInt(cid, 10) === parseInt(newParent, 10)) {
			return callback(new Error('[[error:cant-set-self-as-parent]]'));
		}
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
			], function(err) {
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

	Categories.parseDescription = function(cid, description, callback) {
		plugins.fireHook('filter:parse.raw', description, function(err, parsedDescription) {
			if (err) {
				return callback(err);
			}
			Categories.setCategoryField(cid, 'descriptionParsed', parsedDescription, callback);
		});
	};

};
