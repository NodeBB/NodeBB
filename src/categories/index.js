
'use strict';

const _ = require('lodash');

const db = require('../database');
const user = require('../user');
const groups = require('../groups');
const plugins = require('../plugins');
const privileges = require('../privileges');
const cache = require('../cache');

const Categories = module.exports;

require('./data')(Categories);
require('./create')(Categories);
require('./delete')(Categories);
require('./topics')(Categories);
require('./unread')(Categories);
require('./activeusers')(Categories);
require('./recentreplies')(Categories);
require('./update')(Categories);
require('./watch')(Categories);
require('./search')(Categories);

Categories.exists = async function (cid) {
	if (Array.isArray(cid)) {
		return await db.exists(cid.map(cid => `category:${cid}`));
	}
	return await db.exists(`category:${cid}`);
};

Categories.getCategoryById = async function (data) {
	const categories = await Categories.getCategories([data.cid], data.uid);
	if (!categories[0]) {
		return null;
	}
	const category = categories[0];
	data.category = category;

	const promises = [
		Categories.getCategoryTopics(data),
		Categories.getTopicCount(data),
		Categories.getWatchState([data.cid], data.uid),
		getChildrenTree(category, data.uid),
	];

	if (category.parentCid) {
		promises.push(Categories.getCategoryData(category.parentCid));
	}
	const [topics, topicCount, watchState, , parent] = await Promise.all(promises);

	category.topics = topics.topics;
	category.nextStart = topics.nextStart;
	category.topic_count = topicCount;
	category.isWatched = watchState[0] === Categories.watchStates.watching;
	category.isNotWatched = watchState[0] === Categories.watchStates.notwatching;
	category.isIgnored = watchState[0] === Categories.watchStates.ignoring;
	category.parent = parent;

	calculateTopicPostCount(category);
	const result = await plugins.hooks.fire('filter:category.get', {
		category: category,
		...data,
	});
	return result.category;
};

Categories.getAllCidsFromSet = async function (key) {
	let cids = cache.get(key);
	if (cids) {
		return cids.slice();
	}

	cids = await db.getSortedSetRange(key, 0, -1);
	cids = cids.map(cid => parseInt(cid, 10));
	cache.set(key, cids);
	return cids.slice();
};

Categories.getAllCategories = async function (uid) {
	const cids = await Categories.getAllCidsFromSet('categories:cid');
	return await Categories.getCategories(cids, uid);
};

Categories.getCidsByPrivilege = async function (set, uid, privilege) {
	const cids = await Categories.getAllCidsFromSet(set);
	return await privileges.categories.filterCids(privilege, cids, uid);
};

Categories.getCategoriesByPrivilege = async function (set, uid, privilege) {
	const cids = await Categories.getCidsByPrivilege(set, uid, privilege);
	return await Categories.getCategories(cids, uid);
};

Categories.getModerators = async function (cid) {
	const uids = await Categories.getModeratorUids([cid]);
	return await user.getUsersFields(uids[0], ['uid', 'username', 'userslug', 'picture']);
};

Categories.getModeratorUids = async function (cids) {
	const groupNames = cids.reduce((memo, cid) => {
		memo.push(`cid:${cid}:privileges:moderate`);
		memo.push(`cid:${cid}:privileges:groups:moderate`);
		return memo;
	}, []);

	const memberSets = await groups.getMembersOfGroups(groupNames);
	// Every other set is actually a list of user groups, not uids, so convert those to members
	const sets = memberSets.reduce((memo, set, idx) => {
		if (idx % 2) {
			memo.groupNames.push(set);
		} else {
			memo.uids.push(set);
		}

		return memo;
	}, { groupNames: [], uids: [] });

	const uniqGroups = _.uniq(_.flatten(sets.groupNames));
	const groupUids = await groups.getMembersOfGroups(uniqGroups);
	const map = _.zipObject(uniqGroups, groupUids);
	const moderatorUids = cids.map(
		(cid, index) => _.uniq(sets.uids[index].concat(_.flatten(sets.groupNames[index].map(g => map[g]))))
	);
	return moderatorUids;
};

Categories.getCategories = async function (cids, uid) {
	if (!Array.isArray(cids)) {
		throw new Error('[[error:invalid-cid]]');
	}

	if (!cids.length) {
		return [];
	}
	uid = parseInt(uid, 10);

	const [categories, tagWhitelist, hasRead] = await Promise.all([
		Categories.getCategoriesData(cids),
		Categories.getTagWhitelist(cids),
		Categories.hasReadCategories(cids, uid),
	]);
	categories.forEach((category, i) => {
		if (category) {
			category.tagWhitelist = tagWhitelist[i];
			category['unread-class'] = (category.topic_count === 0 || (hasRead[i] && uid !== 0)) ? '' : 'unread';
		}
	});
	return categories;
};

Categories.getTagWhitelist = async function (cids) {
	const cachedData = {};

	const nonCachedCids = cids.filter((cid) => {
		const data = cache.get(`cid:${cid}:tag:whitelist`);
		const isInCache = data !== undefined;
		if (isInCache) {
			cachedData[cid] = data;
		}
		return !isInCache;
	});

	if (!nonCachedCids.length) {
		return cids.map(cid => cachedData[cid]);
	}

	const keys = nonCachedCids.map(cid => `cid:${cid}:tag:whitelist`);
	const data = await db.getSortedSetsMembers(keys);

	nonCachedCids.forEach((cid, index) => {
		cachedData[cid] = data[index];
		cache.set(`cid:${cid}:tag:whitelist`, data[index]);
	});
	return cids.map(cid => cachedData[cid]);
};

function calculateTopicPostCount(category) {
	if (!category) {
		return;
	}

	let postCount = category.post_count;
	let topicCount = category.topic_count;
	if (Array.isArray(category.children)) {
		category.children.forEach((child) => {
			calculateTopicPostCount(child);
			postCount += parseInt(child.totalPostCount, 10) || 0;
			topicCount += parseInt(child.totalTopicCount, 10) || 0;
		});
	}

	category.totalPostCount = postCount;
	category.totalTopicCount = topicCount;
}
Categories.calculateTopicPostCount = calculateTopicPostCount;

Categories.getParents = async function (cids) {
	const categoriesData = await Categories.getCategoriesFields(cids, ['parentCid']);
	const parentCids = categoriesData.filter(c => c && c.parentCid).map(c => c.parentCid);
	if (!parentCids.length) {
		return cids.map(() => null);
	}
	const parentData = await Categories.getCategoriesData(parentCids);
	const cidToParent = _.zipObject(parentCids, parentData);
	return categoriesData.map(category => cidToParent[category.parentCid]);
};

Categories.getChildren = async function (cids, uid) {
	const categoryData = await Categories.getCategoriesFields(cids, ['parentCid']);
	const categories = categoryData.map((category, index) => ({ cid: cids[index], parentCid: category.parentCid }));
	await Promise.all(categories.map(c => getChildrenTree(c, uid)));
	return categories.map(c => c && c.children);
};

async function getChildrenTree(category, uid) {
	let childrenCids = await Categories.getChildrenCids(category.cid);
	childrenCids = await privileges.categories.filterCids('find', childrenCids, uid);
	childrenCids = childrenCids.filter(cid => parseInt(category.cid, 10) !== parseInt(cid, 10));
	if (!childrenCids.length) {
		category.children = [];
		return;
	}
	let childrenData = await Categories.getCategoriesData(childrenCids);
	childrenData = childrenData.filter(Boolean);
	childrenCids = childrenData.map(child => child.cid);
	const hasRead = await Categories.hasReadCategories(childrenCids, uid);
	childrenData.forEach((child, i) => {
		child['unread-class'] = (child.topic_count === 0 || (hasRead[i] && uid !== 0)) ? '' : 'unread';
	});
	Categories.getTree([category].concat(childrenData), category.parentCid);
}

Categories.getChildrenTree = getChildrenTree;

Categories.getParentCids = async function (currentCid) {
	let cid = currentCid;
	const parents = [];
	while (parseInt(cid, 10)) {
		// eslint-disable-next-line
		cid = await Categories.getCategoryField(cid, 'parentCid');
		if (cid) {
			parents.unshift(cid);
		}
	}
	return parents;
};

Categories.getChildrenCids = async function (rootCid) {
	let allCids = [];
	async function recursive(keys) {
		let childrenCids = await db.getSortedSetRange(keys, 0, -1);

		childrenCids = childrenCids.filter(cid => !allCids.includes(parseInt(cid, 10)));
		if (!childrenCids.length) {
			return;
		}
		keys = childrenCids.map(cid => `cid:${cid}:children`);
		childrenCids.forEach(cid => allCids.push(parseInt(cid, 10)));
		await recursive(keys);
	}
	const key = `cid:${rootCid}:children`;
	const cacheKey = `${key}:all`;
	const childrenCids = cache.get(cacheKey);
	if (childrenCids) {
		return childrenCids.slice();
	}

	await recursive(key);
	allCids = _.uniq(allCids);
	cache.set(cacheKey, allCids);
	return allCids.slice();
};

Categories.flattenCategories = function (allCategories, categoryData) {
	categoryData.forEach((category) => {
		if (category) {
			allCategories.push(category);

			if (Array.isArray(category.children) && category.children.length) {
				Categories.flattenCategories(allCategories, category.children);
			}
		}
	});
};

/**
 * build tree from flat list of categories
 *
 * @param categories {array} flat list of categories
 * @param parentCid {number} start from 0 to build full tree
 */
Categories.getTree = function (categories, parentCid) {
	parentCid = parentCid || 0;
	const cids = categories.map(category => category && category.cid);
	const cidToCategory = {};
	const parents = {};
	cids.forEach((cid, index) => {
		if (cid) {
			categories[index].children = undefined;
			cidToCategory[cid] = categories[index];
			parents[cid] = { ...categories[index] };
		}
	});

	const tree = [];

	categories.forEach((category) => {
		if (category) {
			category.children = category.children || [];
			if (!category.cid) {
				return;
			}
			if (!category.hasOwnProperty('parentCid') || category.parentCid === null) {
				category.parentCid = 0;
			}
			if (category.parentCid === parentCid) {
				tree.push(category);
				category.parent = parents[parentCid];
			} else {
				const parent = cidToCategory[category.parentCid];
				if (parent && parent.cid !== category.cid) {
					category.parent = parents[category.parentCid];
					parent.children = parent.children || [];
					parent.children.push(category);
				}
			}
		}
	});
	function sortTree(tree) {
		tree.sort((a, b) => {
			if (a.order !== b.order) {
				return a.order - b.order;
			}
			return a.cid - b.cid;
		});
		tree.forEach((category) => {
			if (category && Array.isArray(category.children)) {
				sortTree(category.children);
			}
		});
	}
	sortTree(tree);

	categories.forEach(c => calculateTopicPostCount(c));
	return tree;
};

Categories.buildForSelect = async function (uid, privilege, fields) {
	const cids = await Categories.getCidsByPrivilege('categories:cid', uid, privilege);
	return await getSelectData(cids, fields);
};

Categories.buildForSelectAll = async function (fields) {
	const cids = await Categories.getAllCidsFromSet('categories:cid');
	return await getSelectData(cids, fields);
};

async function getSelectData(cids, fields) {
	const categoryData = await Categories.getCategoriesData(cids);
	const tree = Categories.getTree(categoryData);
	return Categories.buildForSelectCategories(tree, fields);
}

Categories.buildForSelectCategories = function (categories, fields, parentCid) {
	function recursive(category, categoriesData, level, depth) {
		const bullet = level ? '&bull; ' : '';
		category.value = category.cid;
		category.level = level;
		category.text = level + bullet + category.name;
		category.depth = depth;
		categoriesData.push(category);
		if (Array.isArray(category.children)) {
			category.children.forEach(child => recursive(child, categoriesData, `&nbsp;&nbsp;&nbsp;&nbsp;${level}`, depth + 1));
		}
	}
	parentCid = parentCid || 0;
	const categoriesData = [];

	const rootCategories = categories.filter(category => category && category.parentCid === parentCid);

	rootCategories.forEach(category => recursive(category, categoriesData, '', 0));

	const pickFields = [
		'cid', 'name', 'level', 'icon',	'parentCid',
		'color', 'bgColor', 'backgroundImage', 'imageClass',
	];
	fields = fields || [];
	if (fields.includes('text') && fields.includes('value')) {
		return categoriesData.map(category => _.pick(category, fields));
	}
	if (fields.length) {
		pickFields.push(...fields);
	}

	return categoriesData.map(category => _.pick(category, pickFields));
};

require('../promisify')(Categories);
