'use strict';

const meta = require('../meta');
const categories = require('../categories');
const topics = require('../topics');
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

categoriesAPI.list = async (caller) => {
	async function getCategories() {
		const cids = await categories.getCidsByPrivilege('categories:cid', caller.uid, 'find');
		return await categories.getCategoriesData(cids);
	}

	const [isAdmin, categoriesData] = await Promise.all([
		user.isAdministrator(caller.uid),
		getCategories(),
	]);

	return {
		categories: categoriesData.filter(category => category && (!category.disabled || isAdmin)),
	};
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
	const categoryObjs = await categories.getCategories([response.cid]);
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

categoriesAPI.getTopicCount = async (caller, { cid }) => {
	const allowed = await privileges.categories.can('find', cid, caller.uid);
	if (!allowed) {
		throw new Error('[[error:no-privileges]]');
	}
	const count = await categories.getCategoryField(cid, 'topic_count');
	return { count };
};

categoriesAPI.getPosts = async (caller, { cid }) => await categories.getRecentReplies(cid, caller.uid, 0, 4);

categoriesAPI.getChildren = async (caller, { cid, start }) => {
	if (!start || start < 0) {
		start = 0;
	}
	start = parseInt(start, 10);

	const allowed = await privileges.categories.can('read', cid, caller.uid);
	if (!allowed) {
		throw new Error('[[error:no-privileges]]');
	}

	const category = await categories.getCategoryData(cid);
	await categories.getChildrenTree(category, caller.uid);
	const allCategories = [];
	categories.flattenCategories(allCategories, category.children);
	await categories.getRecentTopicReplies(allCategories, caller.uid);

	const payload = category.children.slice(start, start + category.subCategoriesPerPage);
	return { categories: payload };
};

categoriesAPI.getTopics = async (caller, data) => {
	data.query = data.query || {};
	const [userPrivileges, settings, targetUid] = await Promise.all([
		privileges.categories.get(data.cid, caller.uid),
		user.getSettings(caller.uid),
		user.getUidByUserslug(data.query.author),
	]);

	if (!userPrivileges.read) {
		throw new Error('[[error:no-privileges]]');
	}

	const infScrollTopicsPerPage = 20;
	const sort = data.sort || data.categoryTopicSort || meta.config.categoryTopicSort || 'recently_replied';

	let start = Math.max(0, parseInt(data.after || 0, 10));

	if (parseInt(data.direction, 10) === -1) {
		start -= infScrollTopicsPerPage;
	}

	let stop = start + infScrollTopicsPerPage - 1;

	start = Math.max(0, start);
	stop = Math.max(0, stop);
	const result = await categories.getCategoryTopics({
		uid: caller.uid,
		cid: data.cid,
		start,
		stop,
		sort,
		settings,
		query: data.query,
		tag: data.query.tag,
		targetUid,
	});
	categories.modifyTopicsByPrivilege(result.topics, userPrivileges);

	return { ...result, privileges: userPrivileges };
};

categoriesAPI.setWatchState = async (caller, { cid, state, uid }) => {
	let targetUid = caller.uid;
	const cids = Array.isArray(cid) ? cid.map(cid => parseInt(cid, 10)) : [parseInt(cid, 10)];
	if (uid) {
		targetUid = uid;
	}
	await user.isAdminOrGlobalModOrSelf(caller.uid, targetUid);
	const allCids = await categories.getAllCidsFromSet('categories:cid');
	const categoryData = await categories.getCategoriesFields(allCids, ['cid', 'parentCid']);

	// filter to subcategories of cid
	let cat;
	do {
		cat = categoryData.find(c => !cids.includes(c.cid) && cids.includes(c.parentCid));
		if (cat) {
			cids.push(cat.cid);
		}
	} while (cat);

	await user.setCategoryWatchState(targetUid, cids, state);
	await topics.pushUnreadCount(targetUid);

	return { cids };
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
