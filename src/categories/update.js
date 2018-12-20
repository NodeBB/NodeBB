'use strict';

var async = require('async');

var db = require('../database');
var meta = require('../meta');
var utils = require('../utils');
var translator = require('../translator');
var plugins = require('../plugins');
var cache = require('../cache');

module.exports = function (Categories) {
	Categories.update = function (modified, callback) {
		var cids = Object.keys(modified);

		async.each(cids, function (cid, next) {
			updateCategory(cid, modified[cid], next);
		}, function (err) {
			callback(err, cids);
		});
	};

	function updateCategory(cid, modifiedFields, callback) {
		var category;
		async.waterfall([
			function (next) {
				Categories.exists(cid, next);
			},
			function (exists, next) {
				if (!exists) {
					return callback();
				}

				if (modifiedFields.hasOwnProperty('name')) {
					translator.translate(modifiedFields.name, function (translated) {
						modifiedFields.slug = cid + '/' + utils.slugify(translated);
						next();
					});
				} else {
					next();
				}
			},
			function (next) {
				plugins.fireHook('filter:category.update', { cid: cid, category: modifiedFields }, next);
			},
			function (categoryData, next) {
				category = categoryData.category;
				var fields = Object.keys(category);
				// move parent to front, so its updated first
				var parentCidIndex = fields.indexOf('parentCid');
				if (parentCidIndex !== -1 && fields.length > 1) {
					fields.splice(0, 0, fields.splice(parentCidIndex, 1)[0]);
				}

				async.eachSeries(fields, function (key, next) {
					updateCategoryField(cid, key, category[key], next);
				}, next);
			},
			function (next) {
				plugins.fireHook('action:category.update', { cid: cid, modified: category });
				next();
			},
		], callback);
	}

	function updateCategoryField(cid, key, value, callback) {
		if (key === 'parentCid') {
			return updateParent(cid, value, callback);
		} else if (key === 'tagWhitelist') {
			return updateTagWhitelist(cid, value, callback);
		}

		async.waterfall([
			function (next) {
				db.setObjectField('category:' + cid, key, value, next);
			},
			function (next) {
				if (key === 'order') {
					updateOrder(cid, value, next);
				} else if (key === 'description') {
					Categories.parseDescription(cid, value, next);
				} else {
					next();
				}
			},
		], callback);
	}

	function updateParent(cid, newParent, callback) {
		if (parseInt(cid, 10) === parseInt(newParent, 10)) {
			return callback(new Error('[[error:cant-set-self-as-parent]]'));
		}
		async.waterfall([
			function (next) {
				Categories.getChildrenCids(cid, next);
			},
			function (childrenCids, next) {
				if (childrenCids.includes(parseInt(newParent, 10))) {
					return next(new Error('[[error:cant-set-child-as-parent]]'));
				}
				Categories.getCategoryField(cid, 'parentCid', next);
			},
			function (oldParent, next) {
				async.series([
					function (next) {
						db.sortedSetRemove('cid:' + oldParent + ':children', cid, next);
					},
					function (next) {
						newParent = parseInt(newParent, 10) || 0;
						db.sortedSetAdd('cid:' + newParent + ':children', cid, cid, next);
					},
					function (next) {
						db.setObjectField('category:' + cid, 'parentCid', newParent, next);
					},
					function (next) {
						cache.del(['cid:' + oldParent + ':children', 'cid:' + newParent + ':children']);
						next();
					},
				], next);
			},
		], function (err) {
			callback(err);
		});
	}

	function updateTagWhitelist(cid, tags, callback) {
		tags = tags.split(',');
		tags = tags.map(function (tag) {
			return utils.cleanUpTag(tag, meta.config.maximumTagLength);
		}).filter(Boolean);

		async.waterfall([
			function (next) {
				db.delete('cid:' + cid + ':tag:whitelist', next);
			},
			function (next) {
				var scores = tags.map((tag, index) => index);
				db.sortedSetAdd('cid:' + cid + ':tag:whitelist', scores, tags, next);
			},
			function (next) {
				cache.del('cid:' + cid + ':tag:whitelist');
				next();
			},
		], callback);
	}

	function updateOrder(cid, order, callback) {
		async.waterfall([
			function (next) {
				Categories.getCategoryField(cid, 'parentCid', next);
			},
			function (parentCid, next) {
				async.parallel([
					function (next) {
						db.sortedSetAdd('categories:cid', order, cid, next);
					},
					function (next) {
						db.sortedSetAdd('cid:' + parentCid + ':children', order, cid, next);
					},
					function (next) {
						cache.del(['categories:cid', 'cid:' + parentCid + ':children']);
						next();
					},
				], next);
			},
		], function (err) {
			callback(err);
		});
	}

	Categories.parseDescription = function (cid, description, callback) {
		async.waterfall([
			function (next) {
				plugins.fireHook('filter:parse.raw', description, next);
			},
			function (parsedDescription, next) {
				Categories.setCategoryField(cid, 'descriptionParsed', parsedDescription, next);
			},
		], callback);
	};
};
