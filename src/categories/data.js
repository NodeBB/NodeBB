'use strict';

var async = require('async');
var validator = require('validator');

var db = require('../database');

const intFields = ['cid', 'parentCid', 'disabled', 'isSection', 'order', 'topic_count', 'post_count'];

module.exports = function (Categories) {
	Categories.getCategoriesFields = function (cids, fields, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		var keys = cids.map(cid => 'category:' + cid);

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

	Categories.getCategoryData = function (cid, callback) {
		Categories.getCategoriesFields([cid], [], function (err, categories) {
			callback(err, categories && categories.length ? categories[0] : null);
		});
	};

	Categories.getCategoriesData = function (cids, callback) {
		Categories.getCategoriesFields(cids, [], callback);
	};

	Categories.getCategoryField = function (cid, field, callback) {
		Categories.getCategoryFields(cid, [field], function (err, category) {
			callback(err, category ? category[field] : null);
		});
	};

	Categories.getCategoryFields = function (cid, fields, callback) {
		Categories.getCategoriesFields([cid], fields, function (err, categories) {
			callback(err, categories ? categories[0] : null);
		});
	};

	Categories.getAllCategoryFields = function (fields, callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
			function (cids, next) {
				Categories.getCategoriesFields(cids, fields, next);
			},
		], callback);
	};

	Categories.setCategoryField = function (cid, field, value, callback) {
		db.setObjectField('category:' + cid, field, value, callback);
	};

	Categories.incrementCategoryFieldBy = function (cid, field, value, callback) {
		db.incrObjectFieldBy('category:' + cid, field, value, callback);
	};
};

function modifyCategory(category) {
	if (!category) {
		return;
	}

	intFields.forEach(field => db.parseIntField(category, field));

	if (category.hasOwnProperty('name')) {
		category.name = validator.escape(String(category.name || ''));
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
