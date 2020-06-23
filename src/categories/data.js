'use strict';

var validator = require('validator');

var db = require('../database');

const intFields = [
	'cid', 'parentCid', 'disabled', 'isSection', 'order',
	'topic_count', 'post_count', 'numRecentReplies',
];

module.exports = function (Categories) {
	Categories.getCategoriesFields = async function (cids, fields) {
		if (!Array.isArray(cids) || !cids.length) {
			return [];
		}

		const keys = cids.map(cid => 'category:' + cid);
		const categories = await (fields.length ? db.getObjectsFields(keys, fields) : db.getObjects(keys));
		categories.forEach(category => modifyCategory(category, fields));
		return categories;
	};

	Categories.getCategoryData = async function (cid) {
		const categories = await Categories.getCategoriesFields([cid], []);
		return categories && categories.length ? categories[0] : null;
	};

	Categories.getCategoriesData = async function (cids) {
		return await Categories.getCategoriesFields(cids, []);
	};

	Categories.getCategoryField = async function (cid, field) {
		const category = await Categories.getCategoryFields(cid, [field]);
		return category ? category[field] : null;
	};

	Categories.getCategoryFields = async function (cid, fields) {
		const categories = await Categories.getCategoriesFields([cid], fields);
		return categories ? categories[0] : null;
	};

	Categories.getAllCategoryFields = async function (fields) {
		const cids = await Categories.getAllCidsFromSet('categories:cid');
		return await Categories.getCategoriesFields(cids, fields);
	};

	Categories.setCategoryField = async function (cid, field, value) {
		await db.setObjectField('category:' + cid, field, value);
	};

	Categories.incrementCategoryFieldBy = async function (cid, field, value) {
		await db.incrObjectFieldBy('category:' + cid, field, value);
	};
};

function modifyCategory(category, fields) {
	if (!category) {
		return;
	}

	db.parseIntFields(category, intFields, fields);

	if (category.hasOwnProperty('name')) {
		category.name = validator.escape(String(category.name || ''));
	}

	if (category.hasOwnProperty('icon')) {
		category.icon = category.icon || 'hidden';
	}

	if (category.hasOwnProperty('post_count')) {
		category.totalPostCount = category.post_count;
	}

	if (category.hasOwnProperty('topic_count')) {
		category.totalTopicCount = category.topic_count;
	}

	if (category.description) {
		category.description = validator.escape(String(category.description));
		category.descriptionParsed = category.descriptionParsed || category.description;
	}
}
