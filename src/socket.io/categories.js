'use strict';

const categories = require('../categories');
const privileges = require('../privileges');
const user = require('../user');
const topics = require('../topics');
const api = require('../api');
const sockets = require('.');

const SocketCategories = module.exports;

SocketCategories.getRecentReplies = async function (socket, cid) {
	return await categories.getRecentReplies(cid, socket.uid, 4);
};

SocketCategories.get = async function (socket) {
	async function getCategories() {
		const cids = await categories.getCidsByPrivilege('categories:cid', socket.uid, 'find');
		return await categories.getCategoriesData(cids);
	}
	const [isAdmin, categoriesData] = await Promise.all([
		user.isAdministrator(socket.uid),
		getCategories(),
	]);
	return categoriesData.filter(category => category && (!category.disabled || isAdmin));
};

SocketCategories.getWatchedCategories = async function (socket) {
	const [categoriesData, ignoredCids] = await Promise.all([
		categories.getCategoriesByPrivilege('cid:0:children', socket.uid, 'find'),
		user.getIgnoredCategories(socket.uid),
	]);
	return categoriesData.filter(category => category && !ignoredCids.includes(String(category.cid)));
};

SocketCategories.loadMore = async function (socket, data) {
	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	data.query = data.query || {};
	const [userPrivileges, settings, targetUid] = await Promise.all([
		privileges.categories.get(data.cid, socket.uid),
		user.getSettings(socket.uid),
		user.getUidByUserslug(data.query.author),
	]);

	if (!userPrivileges.read) {
		throw new Error('[[error:no-privileges]]');
	}

	const infScrollTopicsPerPage = 20;
	const sort = data.sort || data.categoryTopicSort;

	let start = Math.max(0, parseInt(data.after, 10));

	if (data.direction === -1) {
		start -= infScrollTopicsPerPage;
	}

	let stop = start + infScrollTopicsPerPage - 1;

	start = Math.max(0, start);
	stop = Math.max(0, stop);
	const result = await categories.getCategoryTopics({
		uid: socket.uid,
		cid: data.cid,
		start: start,
		stop: stop,
		sort: sort,
		settings: settings,
		query: data.query,
		tag: data.query.tag,
		targetUid: targetUid,
	});
	categories.modifyTopicsByPrivilege(data.topics, userPrivileges);

	result.privileges = userPrivileges;
	result.template = {
		category: true,
		name: 'category',
	};
	return result;
};

SocketCategories.getTopicCount = async function (socket, cid) {
	return await categories.getCategoryField(cid, 'topic_count');
};

SocketCategories.getCategoriesByPrivilege = async function (socket, privilege) {
	return await categories.getCategoriesByPrivilege('categories:cid', socket.uid, privilege);
};

SocketCategories.getMoveCategories = async function (socket, data) {
	return await SocketCategories.getSelectCategories(socket, data);
};

SocketCategories.getSelectCategories = async function (socket) {
	const [isAdmin, categoriesData] = await Promise.all([
		user.isAdministrator(socket.uid),
		categories.buildForSelect(socket.uid, 'find', ['disabled', 'link']),
	]);
	return categoriesData.filter(category => category && (!category.disabled || isAdmin) && !category.link);
};

SocketCategories.setWatchState = async function (socket, data) {
	if (!data || !data.cid || !data.state) {
		throw new Error('[[error:invalid-data]]');
	}
	return await ignoreOrWatch(async function (uid, cids) {
		await user.setCategoryWatchState(uid, cids, categories.watchStates[data.state]);
	}, socket, data);
};

SocketCategories.watch = async function (socket, data) {
	return await ignoreOrWatch(user.watchCategory, socket, data);
};

SocketCategories.ignore = async function (socket, data) {
	return await ignoreOrWatch(user.ignoreCategory, socket, data);
};

async function ignoreOrWatch(fn, socket, data) {
	let targetUid = socket.uid;
	const cids = Array.isArray(data.cid) ? data.cid.map(cid => parseInt(cid, 10)) : [parseInt(data.cid, 10)];
	if (data.hasOwnProperty('uid')) {
		targetUid = data.uid;
	}
	await user.isAdminOrGlobalModOrSelf(socket.uid, targetUid);
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

	await fn(targetUid, cids);
	await topics.pushUnreadCount(targetUid);
	return cids;
}

SocketCategories.isModerator = async function (socket, cid) {
	return await user.isModerator(socket.uid, cid);
};

SocketCategories.getCategory = async function (socket, cid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/categories/:tid');
	return await api.categories.get(socket, { cid });
	// return await apiController.getCategoryData(cid, socket.uid);
};

SocketCategories.loadMoreSubCategories = async function (socket, data) {
	if (!data || !data.cid || !(parseInt(data.start, 10) > 0)) {
		throw new Error('[[error:invalid-data]]');
	}
	const allowed = await privileges.categories.can('read', data.cid, socket.uid);
	if (!allowed) {
		throw new Error('[[error:no-privileges]]');
	}
	const category = await categories.getCategoryData(data.cid);
	await categories.getChildrenTree(category, socket.uid);
	const allCategories = [];
	categories.flattenCategories(allCategories, category.children);
	await categories.getRecentTopicReplies(allCategories, socket.uid);
	const start = parseInt(data.start, 10);
	return category.children.slice(start, start + category.subCategoriesPerPage);
};

require('../promisify')(SocketCategories);
