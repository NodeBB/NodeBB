'use strict';

var async = require('async');
var validator = require('validator');
var winston = require('winston');

var db = require('../database');

module.exports = function(Categories) {

	Categories.getCategoryData = function(cid, callback) {
		db.getObject('category:' + cid, function(err, category) {
			if (err) {
				return callback(err);
			}

			modifyCategory(category);
			callback(null, category);
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

			categories.forEach(modifyCategory);
			callback(null, categories);
		});
	};

	function modifyCategory(category) {
		if (!category) {
			return;
		}

		category.name = validator.escape(category.name || '');
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
			category.description = validator.escape(category.description);
			category.descriptionParsed = category.descriptionParsed || category.description;
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

			categories.forEach(modifyCategory);
			callback(null, categories);
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