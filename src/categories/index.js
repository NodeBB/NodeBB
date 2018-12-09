
'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var user = require('../user');
var Groups = require('../groups');
var plugins = require('../plugins');
var privileges = require('../privileges');
const cache = require('../cache');

var Categories = module.exports;

require('./data')(Categories);
require('./create')(Categories);
require('./delete')(Categories);
require('./topics')(Categories);
require('./unread')(Categories);
require('./activeusers')(Categories);
require('./recentreplies')(Categories);
require('./update')(Categories);

Categories.exists = function (cid, callback) {
	db.exists('category:' + cid, callback);
};

Categories.getCategoryById = function (data, callback) {
	var category;
	async.waterfall([
		function (next) {
			Categories.getCategories([data.cid], data.uid, next);
		},
		function (categories, next) {
			if (!categories[0]) {
				return callback(null, null);
			}
			category = categories[0];
			data.category = category;
			async.parallel({
				topics: function (next) {
					Categories.getCategoryTopics(data, next);
				},
				topicCount: function (next) {
					Categories.getTopicCount(data, next);
				},
				isIgnored: function (next) {
					Categories.isIgnored([data.cid], data.uid, next);
				},
				parent: function (next) {
					if (category.parentCid) {
						Categories.getCategoryData(category.parentCid, next);
					} else {
						next();
					}
				},
				children: function (next) {
					getChildrenTree(category, data.uid, next);
				},
			}, next);
		},
		function (results, next) {
			category.topics = results.topics.topics;
			category.nextStart = results.topics.nextStart;
			category.topic_count = results.topicCount;
			category.isIgnored = results.isIgnored[0];
			category.parent = results.parent;

			calculateTopicPostCount(category);
			plugins.fireHook('filter:category.get', { category: category, uid: data.uid }, next);
		},
		function (data, next) {
			next(null, data.category);
		},
	], callback);
};

Categories.isIgnored = function (cids, uid, callback) {
	if (parseInt(uid, 10) <= 0) {
		return setImmediate(callback, null, cids.map(() => false));
	}
	db.isSortedSetMembers('uid:' + uid + ':ignored:cids', cids, callback);
};

Categories.getAllCidsFromSet = function (key, callback) {
	const cids = cache.get(key);
	if (cids) {
		return setImmediate(callback, null, cids.slice());
	}

	db.getSortedSetRange(key, 0, -1, function (err, cids) {
		if (err) {
			return callback(err);
		}
		cache.set(key, cids);
		callback(null, cids.slice());
	});
};

Categories.getAllCategories = function (uid, callback) {
	async.waterfall([
		function (next) {
			Categories.getAllCidsFromSet('categories:cid', next);
		},
		function (cids, next) {
			Categories.getCategories(cids, uid, next);
		},
	], callback);
};

Categories.getCidsByPrivilege = function (set, uid, privilege, callback) {
	async.waterfall([
		function (next) {
			Categories.getAllCidsFromSet(set, next);
		},
		function (cids, next) {
			privileges.categories.filterCids(privilege, cids, uid, next);
		},
	], callback);
};

Categories.getCategoriesByPrivilege = function (set, uid, privilege, callback) {
	async.waterfall([
		function (next) {
			Categories.getCidsByPrivilege(set, uid, privilege, next);
		},
		function (cids, next) {
			Categories.getCategories(cids, uid, next);
		},
	], callback);
};

Categories.getModerators = function (cid, callback) {
	async.waterfall([
		function (next) {
			Groups.getMembers('cid:' + cid + ':privileges:moderate', 0, -1, next);
		},
		function (uids, next) {
			user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
		},
	], callback);
};

Categories.getCategories = function (cids, uid, callback) {
	if (!Array.isArray(cids)) {
		return callback(new Error('[[error:invalid-cid]]'));
	}

	if (!cids.length) {
		return callback(null, []);
	}
	uid = parseInt(uid, 10);
	async.waterfall([
		function (next) {
			async.parallel({
				categories: function (next) {
					Categories.getCategoriesData(cids, next);
				},
				tagWhitelist: function (next) {
					Categories.getTagWhitelist(cids, next);
				},
				hasRead: function (next) {
					Categories.hasReadCategories(cids, uid, next);
				},
			}, next);
		},
		function (results, next) {
			results.categories.forEach(function (category, i) {
				if (category) {
					category.tagWhitelist = results.tagWhitelist[i];
					category['unread-class'] = (category.topic_count === 0 || (results.hasRead[i] && uid !== 0)) ? '' : 'unread';
				}
			});
			next(null, results.categories);
		},
	], callback);
};

Categories.getTagWhitelist = function (cids, callback) {
	const cachedData = {};

	const nonCachedCids = cids.filter((cid) => {
		const data = cache.get('cid:' + cid + ':tag:whitelist');
		const isInCache = data !== undefined;
		if (isInCache) {
			cachedData[cid] = data;
		}
		return !isInCache;
	});

	if (!nonCachedCids.length) {
		return setImmediate(callback, null, _.clone(cids.map(cid => cachedData[cid])));
	}

	const keys = nonCachedCids.map(cid => 'cid:' + cid + ':tag:whitelist');
	db.getSortedSetsMembers(keys, function (err, data) {
		if (err) {
			return callback(err);
		}
		nonCachedCids.forEach((cid, index) => {
			cachedData[cid] = data[index];
			cache.set('cid:' + cid + ':tag:whitelist', data[index]);
		});
		callback(null, _.clone(cids.map(cid => cachedData[cid])));
	});
};

function calculateTopicPostCount(category) {
	if (!category) {
		return;
	}

	var postCount = category.post_count;
	var topicCount = category.topic_count;
	if (!Array.isArray(category.children) || !category.children.length) {
		category.totalPostCount = postCount;
		category.totalTopicCount = topicCount;
		return;
	}

	category.children.forEach(function (child) {
		calculateTopicPostCount(child);
		postCount += parseInt(child.totalPostCount, 10) || 0;
		topicCount += parseInt(child.totalTopicCount, 10) || 0;
	});

	category.totalPostCount = postCount;
	category.totalTopicCount = topicCount;
}

Categories.getParents = function (cids, callback) {
	var categoriesData;
	var parentCids;
	async.waterfall([
		function (next) {
			Categories.getCategoriesFields(cids, ['parentCid'], next);
		},
		function (_categoriesData, next) {
			categoriesData = _categoriesData;

			parentCids = categoriesData.filter(c => c && c.parentCid).map(c => c.parentCid);

			if (!parentCids.length) {
				return callback(null, cids.map(() => null));
			}

			Categories.getCategoriesData(parentCids, next);
		},
		function (parentData, next) {
			const cidToParent = _.zipObject(parentCids, parentData);
			parentData = categoriesData.map(category => cidToParent[category.parentCid]);
			next(null, parentData);
		},
	], callback);
};

Categories.getChildren = function (cids, uid, callback) {
	var categories;
	async.waterfall([
		function (next) {
			Categories.getCategoriesFields(cids, ['parentCid'], next);
		},
		function (categoryData, next) {
			categories = categoryData.map((category, index) => ({ cid: cids[index], parentCid: category.parentCid }));
			async.each(categories, function (category, next) {
				getChildrenTree(category, uid, next);
			}, next);
		},
		function (next) {
			next(null, categories.map(c => c && c.children));
		},
	], callback);
};

function getChildrenTree(category, uid, callback) {
	let children;
	async.waterfall([
		function (next) {
			Categories.getChildrenCids(category.cid, next);
		},
		function (children, next) {
			privileges.categories.filterCids('find', children, uid, next);
		},
		function (children, next) {
			children = children.filter(cid => parseInt(category.cid, 10) !== parseInt(cid, 10));
			if (!children.length) {
				category.children = [];
				return callback();
			}
			Categories.getCategoriesData(children, next);
		},
		function (_children, next) {
			children = _children.filter(Boolean);

			const cids = children.map(child => child.cid);
			Categories.hasReadCategories(cids, uid, next);
		},
		function (hasRead, next) {
			hasRead.forEach(function (read, i) {
				const child = children[i];
				child['unread-class'] = (child.topic_count === 0 || (read && uid !== 0)) ? '' : 'unread';
			});
			Categories.getTree([category].concat(children), category.parentCid);
			next();
		},
	], callback);
}

Categories.getChildrenCids = function (rootCid, callback) {
	let allCids = [];
	function recursive(keys, callback) {
		db.getSortedSetRange(keys, 0, -1, function (err, childrenCids) {
			if (err) {
				return callback(err);
			}

			if (!childrenCids.length) {
				return callback();
			}
			const keys = childrenCids.map(cid => 'cid:' + cid + ':children');
			childrenCids.forEach(cid => allCids.push(parseInt(cid, 10)));
			recursive(keys, callback);
		});
	}
	const key = 'cid:' + rootCid + ':children';
	const childrenCids = cache.get(key);
	if (childrenCids) {
		return setImmediate(callback, null, childrenCids.slice());
	}

	recursive(key, function (err) {
		if (err) {
			return callback(err);
		}
		allCids = _.uniq(allCids);
		cache.set(key, allCids);
		callback(null, allCids.slice());
	});
};

Categories.flattenCategories = function (allCategories, categoryData) {
	categoryData.forEach(function (category) {
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
			cidToCategory[cid] = categories[index];
			parents[cid] = _.clone(categories[index]);
		}
	});

	const tree = [];

	categories.forEach(function (category) {
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
		tree.sort((a, b) => a.order - b.order);
		if (tree.children) {
			sortTree(tree.children);
		}
	}
	sortTree(tree);

	categories.forEach(c => calculateTopicPostCount(c));
	return tree;
};

Categories.buildForSelect = function (uid, privilege, callback) {
	async.waterfall([
		function (next) {
			Categories.getCategoriesByPrivilege('categories:cid', uid, privilege, next);
		},
		function (categories, next) {
			categories = Categories.getTree(categories);
			Categories.buildForSelectCategories(categories, next);
		},
	], callback);
};

Categories.buildForSelectCategories = function (categories, callback) {
	function recursive(category, categoriesData, level, depth) {
		var bullet = level ? '&bull; ' : '';
		category.value = category.cid;
		category.level = level;
		category.text = level + bullet + category.name;
		category.depth = depth;
		categoriesData.push(category);
		if (Array.isArray(category.children)) {
			category.children.forEach(function (child) {
				recursive(child, categoriesData, '&nbsp;&nbsp;&nbsp;&nbsp;' + level, depth + 1);
			});
		}
	}

	var categoriesData = [];

	categories = categories.filter(category => category && !category.parentCid);

	categories.forEach(function (category) {
		recursive(category, categoriesData, '', 0);
	});
	callback(null, categoriesData);
};

Categories.getIgnorers = function (cid, start, stop, callback) {
	db.getSortedSetRevRange('cid:' + cid + ':ignorers', start, stop, callback);
};

Categories.filterIgnoringUids = function (cid, uids, callback) {
	async.waterfall([
		function (next) {
			db.isSortedSetMembers('cid:' + cid + ':ignorers', uids, next);
		},
		function (isIgnoring, next) {
			const readingUids = uids.filter((uid, index) => uid && !isIgnoring[index]);
			next(null, readingUids);
		},
	], callback);
};

Categories.async = require('../promisify')(Categories);
