'use strict';

const categories = require('../categories');
const events = require('../events');
const privileges = require('../privileges');

const categoriesAPI = module.exports;

categoriesAPI.get = async function (caller, data) {
	const [userPrivileges, category] = await Promise.all([
		privileges.categories.get(data.cid, caller.uid),
		categories.getCategoryData(data.cid),
	]);
	if (!category || !userPrivileges.read) {
		return null;
	}

	return category;
};

categoriesAPI.create = async function (caller, data) {
	const response = await categories.create(data);
	const categoryObjs = await categories.getCategories([response.cid], caller.uid);
	return categoryObjs[0];
};

categoriesAPI.update = async function (caller, data) {
	await categories.update(data);
};

categoriesAPI.delete = async function (caller, data) {
	const name = await categories.getCategoryField(data.cid, 'name');
	await categories.purge(data.cid, caller.uid);
	await events.log({
		type: 'category-purge',
		uid: caller.uid,
		ip: caller.ip,
		cid: data.cid,
		name: name,
	});
};
