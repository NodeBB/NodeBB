'use strict';

const validator = require('validator');

const db = require('../database');
const meta = require('../meta');
const plugins = require('../plugins');
const utils = require('../utils');

const intFields = [
	'cid', 'parentCid', 'disabled', 'isSection', 'order',
	'topic_count', 'post_count', 'numRecentReplies',
	'minTags', 'maxTags', 'postQueue', 'subCategoriesPerPage',
];

const worldCategory = {
	cid: -1,
	name: '[[category:uncategorized]]',
	description: '[[category:uncategorized.description]]',
	icon: 'fa-globe',
	imageClass: 'cover',
	bgColor: '#eee',
	color: '#333',
	slug: '../world',
	parentCid: 0,
	disabled: 0,
	handle: 'world',
	link: '',
	class: '', // todo
};
worldCategory.descriptionParsed = worldCategory.description;

module.exports = function (Categories) {
	Categories.getCategoriesFields = async function (cids, fields) {
		if (!Array.isArray(cids) || !cids.length) {
			return [];
		}

		cids = cids.map(cid => (utils.isNumber(cid) ? parseInt(cid, 10) : cid));
		const keys = cids.map(cid => (utils.isNumber(cid) ? `category:${cid}` : `categoryRemote:${cid}`));
		const categories = await db.getObjects(keys, fields);

		// Handle cid -1
		if (cids.includes(-1)) {
			let subset = null;
			if (fields && fields.length) {
				subset = fields.reduce((category, field) => {
					category[field] = worldCategory[field] || undefined;
					return category;
				}, {});
			}
			categories.splice(cids.indexOf(-1), 1, subset || { ...worldCategory });
		}

		const result = await plugins.hooks.fire('filter:category.getFields', {
			cids: cids,
			categories: categories,
			fields: fields,
			keys: keys,
		});
		result.categories.forEach(category => modifyCategory(category, fields));
		return result.categories;
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
		return category && category.hasOwnProperty(field) ? category[field] : null;
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
		await db.setObjectField(`${utils.isNumber(cid) ? 'category' : 'categoryRemote'}:${cid}`, field, value);
	};

	Categories.incrementCategoryFieldBy = async function (cid, field, value) {
		await db.incrObjectFieldBy(`${utils.isNumber(cid) ? 'category' : 'categoryRemote'}:${cid}`, field, value);
	};
};

function defaultIntField(category, fields, fieldName, defaultField) {
	if (!fields.length || fields.includes(fieldName)) {
		const useDefault = !category.hasOwnProperty(fieldName) ||
			category[fieldName] === null ||
			category[fieldName] === '' ||
			!utils.isNumber(category[fieldName]);

		category[fieldName] = useDefault ? meta.config[defaultField] : category[fieldName];
	}
}

function modifyCategory(category, fields) {
	if (!category) {
		return;
	}

	defaultIntField(category, fields, 'minTags', 'minimumTagsPerTopic');
	defaultIntField(category, fields, 'maxTags', 'maximumTagsPerTopic');
	defaultIntField(category, fields, 'postQueue', 'postQueue');

	db.parseIntFields(category, intFields, fields);

	const escapeFields = ['name', 'nickname', 'description', 'color', 'bgColor', 'backgroundImage', 'imageClass', 'class', 'link'];
	escapeFields.forEach((field) => {
		if (category.hasOwnProperty(field)) {
			category[field] = validator.escape(String(category[field] || ''));
		}
	});

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
		category.descriptionParsed = category.descriptionParsed || category.description;
	}

	if (category.nickname) {
		category.name = category.nickname;
	}
}
