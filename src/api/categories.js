'use strict';

const categories = require('../categories');
const events = require('../events');
const user = require('../user');
const groups = require('../groups');
const privileges = require('../privileges');

const categoriesAPI = module.exports;

const hasAdminPrivilege = async (uid, privilege = 'categories') => {
	const ok = await privileges.admin.can(`admin:${privilege}`, uid);
	if (!ok) {
		throw new Error('[[error:no-privileges]]');
	}
};

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
	await hasAdminPrivilege(caller.uid);

	const response = await categories.create(data);
	const categoryObjs = await categories.getCategories([response.cid], caller.uid);
	return categoryObjs[0];
};

categoriesAPI.update = async function (caller, data) {
	await hasAdminPrivilege(caller.uid);
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	const { cid, values } = data;

	const payload = {};
	payload[cid] = values;
	await categories.update(payload);
};

categoriesAPI.delete = async function (caller, { cid }) {
	await hasAdminPrivilege(caller.uid);

	const name = await categories.getCategoryField(cid, 'name');
	await categories.purge(cid, caller.uid);
	await events.log({
		type: 'category-purge',
		uid: caller.uid,
		ip: caller.ip,
		cid: cid,
		name: name,
	});
};

categoriesAPI.getPrivileges = async (caller, { cid }) => {
	await hasAdminPrivilege(caller.uid, 'privileges');

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
	await hasAdminPrivilege(caller.uid, 'privileges');

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
	if (parseInt(data.cid, 10) === 0) {
		const adminPrivList = await privileges.admin.getPrivilegeList();
		const adminPrivs = privs.filter(priv => adminPrivList.includes(priv));
		if (adminPrivs.length) {
			await privileges.admin[type](adminPrivs, data.member);
		}
		const globalPrivList = await privileges.global.getPrivilegeList();
		const globalPrivs = privs.filter(priv => globalPrivList.includes(priv));
		if (globalPrivs.length) {
			await privileges.global[type](globalPrivs, data.member);
		}
	} else {
		const categoryPrivList = await privileges.categories.getPrivilegeList();
		const categoryPrivs = privs.filter(priv => categoryPrivList.includes(priv));
		await privileges.categories[type](categoryPrivs, data.cid, data.member);
	}

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

categoriesAPI.setModerator = async (caller, { cid, member, set }) => {
	await hasAdminPrivilege(caller.uid, 'admins-mods');

	const privilegeList = await privileges.categories.getUserPrivilegeList();
	await categoriesAPI.setPrivilege(caller, { cid, privilege: privilegeList, member, set });
};
