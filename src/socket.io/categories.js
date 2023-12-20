'use strict';

/**
 * v4 note — all socket.io methods here have been deprecated, and can be removed for v4
 */

const categories = require('../categories');
const user = require('../user');
const topics = require('../topics');
const api = require('../api');

const sockets = require('.');

const SocketCategories = module.exports;

require('./categories/search')(SocketCategories);

SocketCategories.getRecentReplies = async function (socket, cid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/categories/:cid/posts');
	return await api.categories.getPosts(socket, { cid });
};

SocketCategories.get = async function (socket) {
	sockets.warnDeprecated(socket, 'GET /api/v3/categories');
	const { categories } = await api.categories.list(socket);
	return categories;
};

SocketCategories.getWatchedCategories = async function (socket) {
	sockets.warnDeprecated(socket);

	const [categoriesData, ignoredCids] = await Promise.all([
		categories.getCategoriesByPrivilege('cid:0:children', socket.uid, 'find'),
		user.getIgnoredCategories(socket.uid),
	]);
	return categoriesData.filter(category => category && !ignoredCids.includes(String(category.cid)));
};

SocketCategories.loadMore = async function (socket, data) {
	sockets.warnDeprecated(socket, 'GET /api/v3/categories/:cid/topics');

	if (!data) {
		throw new Error('[[error:invalid-data]]');
	}
	data.query = data.query || {};

	const result = await api.categories.getTopics(socket, data);

	// Backwards compatibility — unsure of current usage.
	result.template = {
		category: true,
		name: 'category',
	};

	return result;
};

SocketCategories.getTopicCount = async function (socket, cid) {
	sockets.warnDeprecated(socket, 'GET /api/v3/categories/:cid');

	const { count } = await api.categories.getTopicCount(socket, { cid });
	return count;
};

SocketCategories.getCategoriesByPrivilege = async function (socket, privilege) {
	sockets.warnDeprecated(socket);

	return await categories.getCategoriesByPrivilege('categories:cid', socket.uid, privilege);
};

SocketCategories.getMoveCategories = async function (socket, data) {
	sockets.warnDeprecated(socket);

	return await SocketCategories.getSelectCategories(socket, data);
};

SocketCategories.getSelectCategories = async function (socket) {
	sockets.warnDeprecated(socket);

	const [isAdmin, categoriesData] = await Promise.all([
		user.isAdministrator(socket.uid),
		categories.buildForSelect(socket.uid, 'find', ['disabled', 'link']),
	]);
	return categoriesData.filter(category => category && (!category.disabled || isAdmin) && !category.link);
};

SocketCategories.setWatchState = async function (socket, data) {
	sockets.warnDeprecated(socket, 'PUT/DELETE /api/v3/categories/:cid/watch');

	if (!data || !data.cid || !data.state) {
		throw new Error('[[error:invalid-data]]');
	}

	data.state = categories.watchStates[data.state];

	await api.categories.setWatchState(socket, data);
	return data.cid;
};

SocketCategories.watch = async function (socket, data) {
	sockets.warnDeprecated(socket);

	return await ignoreOrWatch(user.watchCategory, socket, data);
};

SocketCategories.ignore = async function (socket, data) {
	sockets.warnDeprecated(socket);

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
	sockets.warnDeprecated(socket);

	return await user.isModerator(socket.uid, cid);
};

SocketCategories.loadMoreSubCategories = async function (socket, data) {
	sockets.warnDeprecated(socket, `GET /api/v3/categories/:cid/children`);

	if (!data || !data.cid || !(parseInt(data.start, 10) >= 0)) {
		throw new Error('[[error:invalid-data]]');
	}

	const { categories: children } = await api.categories.getChildren(socket, data);
	return children;
};

require('../promisify')(SocketCategories);
