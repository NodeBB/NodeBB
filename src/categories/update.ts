'use strict';

const db = require('../database');
const meta = require('../meta');
const utils = require('../utils');
const slugify = require('../slugify');
const translator = require('../translator');
const plugins = require('../plugins');
const cache = require('../cache');

module.exports = function (Categories) {
	Categories.update = async function (modified) {
		const cids = Object.keys(modified);
		await Promise.all(cids.map(cid => updateCategory(cid, modified[cid])));
		return cids;
	};

	async function updateCategory(cid, modifiedFields) {
		const exists = await Categories.exists(cid);
		if (!exists) {
			return;
		}

		if (modifiedFields.hasOwnProperty('name')) {
			const translated = await translator.translate(modifiedFields.name);
			modifiedFields.slug = `${cid}/${slugify(translated)}`;
		}
		const result = await plugins.hooks.fire('filter:category.update', { cid: cid, category: modifiedFields });

		const { category } = result;
		const fields = Object.keys(category);
		// move parent to front, so its updated first
		const parentCidIndex = fields.indexOf('parentCid');
		if (parentCidIndex !== -1 && fields.length > 1) {
			fields.splice(0, 0, fields.splice(parentCidIndex, 1)[0]);
		}

		for (const key of fields) {
			// eslint-disable-next-line no-await-in-loop
			await updateCategoryField(cid, key, category[key]);
		}
		plugins.hooks.fire('action:category.update', { cid: cid, modified: category });
	}

	async function updateCategoryField(cid, key, value) {
		if (key === 'parentCid') {
			return await updateParent(cid, value);
		} else if (key === 'tagWhitelist') {
			return await updateTagWhitelist(cid, value);
		} else if (key === 'name') {
			return await updateName(cid, value);
		} else if (key === 'order') {
			return await updateOrder(cid, value);
		}

		await db.setObjectField(`category:${cid}`, key, value);
		if (key === 'description') {
			await Categories.parseDescription(cid, value);
		}
	}

	async function updateParent(cid, newParent) {
		newParent = parseInt(newParent, 10) || 0;
		if (parseInt(cid, 10) === newParent) {
			throw new Error('[[error:cant-set-self-as-parent]]');
		}
		const childrenCids = await Categories.getChildrenCids(cid);
		if (childrenCids.includes(newParent)) {
			throw new Error('[[error:cant-set-child-as-parent]]');
		}
		const categoryData = await Categories.getCategoryFields(cid, ['parentCid', 'order']);
		const oldParent = categoryData.parentCid;
		if (oldParent === newParent) {
			return;
		}
		await Promise.all([
			db.sortedSetRemove(`cid:${oldParent}:children`, cid),
			db.sortedSetAdd(`cid:${newParent}:children`, categoryData.order, cid),
			db.setObjectField(`category:${cid}`, 'parentCid', newParent),
		]);

		cache.del([
			`cid:${oldParent}:children`,
			`cid:${newParent}:children`,
			`cid:${oldParent}:children:all`,
			`cid:${newParent}:children:all`,
		]);
	}

	async function updateTagWhitelist(cid, tags) {
		tags = tags.split(',').map(tag => utils.cleanUpTag(tag, meta.config.maximumTagLength))
			.filter(Boolean);
		await db.delete(`cid:${cid}:tag:whitelist`);
		const scores = tags.map((tag, index) => index);
		await db.sortedSetAdd(`cid:${cid}:tag:whitelist`, scores, tags);
		cache.del(`cid:${cid}:tag:whitelist`);
	}

	async function updateOrder(cid, order) {
		const parentCid = await Categories.getCategoryField(cid, 'parentCid');
		await db.sortedSetsAdd('categories:cid', order, cid);

		const childrenCids = await db.getSortedSetRange(
			`cid:${parentCid}:children`, 0, -1
		);

		const currentIndex = childrenCids.indexOf(String(cid));
		if (currentIndex === -1) {
			throw new Error('[[error:no-category]]');
		}
		// moves cid to index order - 1 in the array
		if (childrenCids.length > 1) {
			childrenCids.splice(Math.max(0, order - 1), 0, childrenCids.splice(currentIndex, 1)[0]);
		}

		// recalculate orders from array indices
		await db.sortedSetAdd(
			`cid:${parentCid}:children`,
			childrenCids.map((cid, index) => index + 1),
			childrenCids
		);

		await db.setObjectBulk(
			childrenCids.map((cid, index) => [`category:${cid}`, { order: index + 1 }])
		);

		cache.del([
			'categories:cid',
			`cid:${parentCid}:children`,
			`cid:${parentCid}:children:all`,
		]);
	}

	Categories.parseDescription = async function (cid, description) {
		const parsedDescription = await plugins.hooks.fire('filter:parse.raw', description);
		await Categories.setCategoryField(cid, 'descriptionParsed', parsedDescription);
	};

	async function updateName(cid, newName) {
		const oldName = await Categories.getCategoryField(cid, 'name');
		await db.sortedSetRemove('categories:name', `${oldName.slice(0, 200).toLowerCase()}:${cid}`);
		await db.sortedSetAdd('categories:name', 0, `${newName.slice(0, 200).toLowerCase()}:${cid}`);
		await db.setObjectField(`category:${cid}`, 'name', newName);
	}
};
