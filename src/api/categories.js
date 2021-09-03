'use strict';

const categories = require('../categories');
const events = require('../events');
const user = require('../user');
const groups = require('../groups');
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

categoriesAPI.getPrivileges = async (caller, cid) => {
	let responsePayload;

	if (cid === 'admin') {
		responsePayload = await privileges.admin.list(caller.uid);
	} else if (!parseInt(cid, 10)) {
		responsePayload = await privileges.global.list();
	} else {
		responsePayload = await privileges.categories.list(cid);
	}

	return responsePayload;
};

categoriesAPI.setPrivilege = async (caller, data) => {
	const [userExists, groupExists] = await Promise.all([
		user.exists(data.member),
		groups.exists(data.member),
	]);

	if (!userExists && !groupExists) {
		throw new Error('[[error:no-user-or-group]]');
	}
	const privs = Array.isArray(data.privilege) ? data.privilege : [data.privilege];
	const type = data.set ? 'give' : 'rescind';
	if (!privs.length) {
		throw new Error('[[error:invalid-data]]');
	}
	let privMethod = privileges.categories[type];
	if (parseInt(data.cid, 10) === 0) {
		if (privs[0].startsWith('admin:')) {
			privMethod = privileges.admin[type];
		} else {
			privMethod = privileges.global[type];
		}
	}
	await privMethod(privs, data.cid, data.member);

	await events.log({
		uid: caller.uid,
		type: 'privilege-change',
		ip: caller.ip,
		privilege: data.privilege.toString(),
		cid: data.cid,
		action: data.set ? 'grant' : 'rescind',
		target: data.member,
	});
};
