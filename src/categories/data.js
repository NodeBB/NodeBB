'use strict';

var async = require('async');
var validator = require('validator');
var winston = require('winston');

var db = require('../database');
var plugins = require('../plugins');

module.exports = function(Categories) {

	Categories.getCategoryData = function(cid, callback) {
		Categories.getCategoriesData([cid], function(err, categories) {
			callback(err, categories ? categories[0] : null);
		});
	};

	Categories.getCategoriesData = function(cids, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}
		var keys = cids.map(function(cid) {
			return 'category:' + cid;
		});

		db.getObjects(keys, function(err, categories) {
			if (err || !Array.isArray(categories) || !categories.length) {
				return callback(err, []);
			}

			async.map(categories, modifyCategory, callback);
		});
	};

	function modifyCategory(category, callback) {
		if (!category) {
			return callback(null, null);
		}

		category.name = validator.escape(category.name);
		category.disabled = category.hasOwnProperty('disabled') ? parseInt(category.disabled, 10) === 1 : undefined;
		category.icon = category.icon || 'hidden';
		if (category.hasOwnProperty('post_count')) {
			category.post_count = category.totalPostCount = category.post_count || 0;
		}

		if (category.hasOwnProperty('topic_count')) {
			category.topic_count = category.totalTopicCount = category.topic_count || 0;
		}

		if (category.image) {
			category.backgroundImage = category.image;
		}

		if (category.description) {
			plugins.fireHook('filter:parse.raw', category.description, function(err, parsedDescription) {
				if (err) {
					return callback(err);
				}
				category.descriptionParsed = parsedDescription;
				category.description = validator.escape(category.description);
				callback(null, category);
			});
		} else {
			callback(null, category);
		}
	}

	Categories.getCategoryField = function(cid, field, callback) {
		db.getObjectField('category:' + cid, field, callback);
	};

	Categories.getCategoriesFields = function(cids, fields, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		var keys = cids.map(function(cid) {
			return 'category:' + cid;
		});

		db.getObjectsFields(keys, fields, function(err, categories) {
			if (err) {
				return callback(err);
			}
			async.map(categories, modifyCategory, callback);
		});
	};

	Categories.getMultipleCategoryFields = function(cids, fields, callback) {
		winston.warn('[deprecated] Categories.getMultipleCategoryFields is deprecated please use Categories.getCategoriesFields');
		Categories.getCategoriesFields(cids, fields, callback);
	};

	Categories.getAllCategoryFields = function(fields, callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
			function(cids, next) {
				Categories.getCategoriesFields(cids, fields, next);
			}
		], callback);
	};

	Categories.getCategoryFields = function(cid, fields, callback) {
		db.getObjectFields('category:' + cid, fields, callback);
	};

	Categories.setCategoryField = function(cid, field, value, callback) {
		db.setObjectField('category:' + cid, field, value, callback);
	};

	Categories.incrementCategoryFieldBy = function(cid, field, value, callback) {
		db.incrObjectFieldBy('category:' + cid, field, value, callback);
	};

};