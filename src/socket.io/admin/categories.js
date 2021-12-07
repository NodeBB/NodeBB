'use strict';


const categories = require('../../categories');

const Categories = module.exports;

Categories.getNames = async function () {
	return await categories.getAllCategoryFields(['cid', 'name']);
};

Categories.copyPrivilegesToChildren = async function (socket, data) {
	const result = await categories.getChildren([data.cid], socket.uid);
	const children = result[0];
	for (const child of children) {
		// eslint-disable-next-line no-await-in-loop
		await copyPrivilegesToChildrenRecursive(data.cid, child, data.group, data.filter);
	}
};

async function copyPrivilegesToChildrenRecursive(parentCid, category, group, filter) {
	await categories.copyPrivilegesFrom(parentCid, category.cid, group, filter);
	for (const child of category.children) {
		// eslint-disable-next-line no-await-in-loop
		await copyPrivilegesToChildrenRecursive(parentCid, child, group, filter);
	}
}

Categories.copySettingsFrom = async function (socket, data) {
	return await categories.copySettingsFrom(data.fromCid, data.toCid, data.copyParent);
};

Categories.copyPrivilegesFrom = async function (socket, data) {
	await categories.copyPrivilegesFrom(data.fromCid, data.toCid, data.group, data.filter);
};

Categories.copyPrivilegesToAllCategories = async function (socket, data) {
	let cids = await categories.getAllCidsFromSet('categories:cid');
	cids = cids.filter(cid => parseInt(cid, 10) !== parseInt(data.cid, 10));
	for (const toCid of cids) {
		// eslint-disable-next-line no-await-in-loop
		await categories.copyPrivilegesFrom(data.cid, toCid, data.group, data.filter);
	}
};
