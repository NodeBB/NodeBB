'use strict';

var async = require('async');
var validator = require('validator');
var winston = require('winston');

var db = require('../database');

module.exports = function (Categories) {
	Categories.getCategoryData = function (cid, callback) {
		async.waterfall([
			function (next) {
				db.getObject('category:' + cid, next);
			},
			function (category, next) {
				modifyCategory(category);
				next(null, category);
			},
		], callback);
	};

	Categories.getCategoriesData = function (cids, callback) {
		Categories.getCategoriesFields(cids, [], callback);
	};

	function modifyCategory(category) {
		if (!category) {
			return;
		}

		if (category.hasOwnProperty('name')) {
			category.name = validator.escape(String(category.name || ''));
		}
		if (category.hasOwnProperty('disabled')) {
			category.disabled = parseInt(category.disabled, 10) === 1;
		}
		if (category.hasOwnProperty('isSection')) {
			category.isSection = parseInt(category.isSection, 10) === 1;
		}

		if (category.hasOwnProperty('icon')) {
			category.icon = category.icon || 'hidden';
		}

		if (category.hasOwnProperty('post_count')) {
			category.post_count = category.post_count || 0;
			category.totalPostCount = category.post_count;
		}

		if (category.hasOwnProperty('topic_count')) {
			category.topic_count = category.topic_count || 0;
			category.totalTopicCount = category.topic_count;
		}

		if (category.image) {
			category.backgroundImage = category.image;
		}

		if (category.description) {
			category.description = validator.escape(String(category.description));
			category.descriptionParsed = category.descriptionParsed || category.description;
		}
	}

	Categories.getCategoryField = function (cid, field, callback) {
		db.getObjectField('category:' + cid, field, callback);
	};

	Categories.getCategoriesFields = function (cids, fields, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		var keys = cids.map(function (cid) {
			return 'category:' + cid;
		});
		async.waterfall([
			function (next) {
				if (fields.length) {
					db.getObjectsFields(keys, fields, next);
				} else {
					db.getObjects(keys, next);
				}
			},
			function (categories, next) {
				categories.forEach(modifyCategory);
				next(null, categories);
			},
		], callback);
	};

	Categories.getMultipleCategoryFields = function (cids, fields, callback) {
		winston.warn('[deprecated] Categories.getMultipleCategoryFields is deprecated please use Categories.getCategoriesFields');
		Categories.getCategoriesFields(cids, fields, callback);
	};

	Categories.getAllCategoryFields = function (fields, callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
			function (cids, next) {
				Categories.getCategoriesFields(cids, fields, next);
			},
		], callback);
	};

	Categories.getCategoryFields = function (cid, fields, callback) {
		db.getObjectFields('category:' + cid, fields, callback);
	};

	Categories.setCategoryField = function (cid, field, value, callback) {
		db.setObjectField('category:' + cid, field, value, callback);
	};

	Categories.incrementCategoryFieldBy = function (cid, field, value, callback) {
		db.incrObjectFieldBy('category:' + cid, field, value, callback);
	};
};
