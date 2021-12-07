'use strict';


const categories = require('../../categories');
const api = require('../../api');
const sockets = require('..');

const Categories = module.exports;

Categories.create = async function (socket, data) {
	sockets.warnDeprecated(socket, 'POST /api/v3/categories');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	return await api.categories.create(socket, data);
};

Categories.getNames = async function () {
	return await categories.getAllCategoryFields(['cid', 'name']);
};

Categories.purge = async function (socket, cid) {
	sockets.warnDeprecated(socket, 'DELETE /api/v3/categories/:cid');

	await api.categories.delete(socket, { cid: cid });
};

Categories.update = async function (socket, data) {
	sockets.warnDeprecated(socket, 'PUT /api/v3/categories/:cid');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	return await api.categories.update(socket, data);
};

Categories.setPrivilege = async function (socket, data) {
	sockets.warnDeprecated(socket, 'PUT /api/v3/categories/:cid/privileges/:privilege');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	return await api.categories.setPrivilege(socket, data);
};

Categories.getPrivilegeSettings = async function (socket, cid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/categories/:cid/privileges');

	if (!isFinite(cid) && cid !== 'admin') {
		throw new Error('[[error:invalid-data]]');
	}
	return await api.categories.getPrivileges(socket, cid);
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
