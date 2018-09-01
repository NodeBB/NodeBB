
'use strict';

var async = require('async');

var db = require('./database');
var user = require('./user');
var Groups = require('./groups');
var plugins = require('./plugins');
var privileges = require('./privileges');

var Categories = module.exports;

require('./categories/data')(Categories);
require('./categories/create')(Categories);
require('./categories/delete')(Categories);
require('./categories/topics')(Categories);
require('./categories/unread')(Categories);
require('./categories/activeusers')(Categories);
require('./categories/recentreplies')(Categories);
require('./categories/update')(Categories);

Categories.exists = function (cid, callback) {
	db.isSortedSetMember('categories:cid', cid, callback);
};

Categories.getCategoryById = function (data, callback) {
	var category;
	async.waterfall([
		function (next) {
			Categories.getCategories([data.cid], data.uid, next);
		},
		function (categories, next) {
			if (!categories[0]) {
				return next(new Error('[[error:invalid-cid]]'));
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
			}, next);
		},
		function (results, next) {
			category.topics = results.topics.topics;
			category.nextStart = results.topics.nextStart;
			category.isIgnored = results.isIgnored[0];
			category.topic_count = results.topicCount;

			plugins.fireHook('filter:category.get', { category: category, uid: data.uid }, next);
		},
		function (data, next) {
			next(null, data.category);
		},
	], callback);
};

Categories.isIgnored = function (cids, uid, callback) {
	db.isSortedSetMembers('uid:' + uid + ':ignored:cids', cids, callback);
};

Categories.getPageCount = function (cid, uid, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				topicCount: async.apply(Categories.getCategoryField, cid, 'topic_count'),
				settings: async.apply(user.getSettings, uid),
			}, next);
		},
		function (results, next) {
			if (!parseInt(results.topicCount, 10)) {
				return next(null, 1);
			}

			next(null, Math.ceil(parseInt(results.topicCount, 10) / results.settings.topicsPerPage));
		},
	], callback);
};

Categories.getAllCategories = function (uid, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('categories:cid', 0, -1, next);
		},
		function (cids, next) {
			Categories.getCategories(cids, uid, next);
		},
	], callback);
};

Categories.getCidsByPrivilege = function (set, uid, privilege, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange(set, 0, -1, next);
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

	async.waterfall([
		function (next) {
			async.parallel({
				categories: function (next) {
					Categories.getCategoriesData(cids, next);
				},
				children: function (next) {
					Categories.getChildren(cids, uid, next);
				},
				parents: function (next) {
					Categories.getParents(cids, next);
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
			uid = parseInt(uid, 10);
			results.categories.forEach(function (category, i) {
				if (category) {
					category.children = results.children[i];
					category.parent = results.parents[i] || undefined;
					category.tagWhitelist = results.tagWhitelist[i];
					category['unread-class'] = (parseInt(category.topic_count, 10) === 0 || (results.hasRead[i] && uid !== 0)) ? '' : 'unread';
					calculateTopicPostCount(category);
				}
			});

			next(null, results.categories);
		},
	], callback);
};

Categories.getTagWhitelist = function (cids, callback) {
	var keys = cids.map(function (cid) {
		return 'cid:' + cid + ':tag:whitelist';
	});
	db.getSortedSetsMembers(keys, callback);
};

function calculateTopicPostCount(category) {
	if (!category) {
		return;
	}

	var postCount = parseInt(category.post_count, 10) || 0;
	var topicCount = parseInt(category.topic_count, 10) || 0;
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

			parentCids = categoriesData.filter(function (category) {
				return category && category.hasOwnProperty('parentCid') && parseInt(category.parentCid, 10);
			}).map(function (category) {
				return parseInt(category.parentCid, 10);
			});

			if (!parentCids.length) {
				return callback(null, cids.map(function () { return null; }));
			}

			Categories.getCategoriesData(parentCids, next);
		},
		function (parentData, next) {
			parentData = categoriesData.map(function (category) {
				return parentData[parentCids.indexOf(parseInt(category.parentCid, 10))];
			});
			next(null, parentData);
		},
	], callback);
};

Categories.getChildren = function (cids, uid, callback) {
	var categories = cids.map(function (cid) {
		return { cid: cid };
	});

	async.each(categories, function (category, next) {
		getChildrenRecursive(category, uid, next);
	}, function (err) {
		callback(err, categories.map(function (c) {
			return c && c.children;
		}));
	});
};

function getChildrenRecursive(category, uid, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('cid:' + category.cid + ':children', 0, -1, next);
		},
		function (children, next) {
			privileges.categories.filterCids('find', children, uid, next);
		},
		function (children, next) {
			children = children.filter(function (cid) {
				return parseInt(category.cid, 10) !== parseInt(cid, 10);
			});
			if (!children.length) {
				category.children = [];
				return callback();
			}
			Categories.getCategoriesData(children, next);
		},
		function (children, next) {
			children = children.filter(Boolean);
			category.children = children;

			var cids = children.map(function (child) {
				return child.cid;
			});

			Categories.hasReadCategories(cids, uid, next);
		},
		function (hasRead, next) {
			hasRead.forEach(function (read, i) {
				var child = category.children[i];
				child['unread-class'] = (parseInt(child.topic_count, 10) === 0 || (read && uid !== 0)) ? '' : 'unread';
			});

			next();
		},
		function (next) {
			async.each(category.children, function (child, next) {
				getChildrenRecursive(child, uid, next);
			}, next);
		},
	], callback);
}

Categories.flattenCategories = function (allCategories, categoryData) {
	categoryData.forEach(function (category) {
		if (category) {
			if (!category.parent) {
				allCategories.push(category);
			}

			if (Array.isArray(category.children) && category.children.length) {
				Categories.flattenCategories(allCategories, category.children);
			}
		}
	});
};

/**
 * Recursively build tree
 *
 * @param categories {array} flat list of categories
 * @param parentCid {number} start from 0 to build full tree
 */
Categories.getTree = function (categories, parentCid) {
	var tree = [];

	categories.forEach(function (category) {
		if (category) {
			if (!category.hasOwnProperty('parentCid') || category.parentCid === null) {
				category.parentCid = 0;
			}

			if (parseInt(category.parentCid, 10) === parseInt(parentCid, 10)) {
				tree.push(category);
				category.children = Categories.getTree(categories, category.cid);
			}
		}
	});

	return tree;
};

Categories.buildForSelect = function (uid, privilege, callback) {
	async.waterfall([
		function (next) {
			Categories.getCategoriesByPrivilege('cid:0:children', uid, privilege, next);
		},
		function (categories, next) {
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

		category.children.forEach(function (child) {
			recursive(child, categoriesData, '&nbsp;&nbsp;&nbsp;&nbsp;' + level, depth + 1);
		});
	}

	var categoriesData = [];

	categories = categories.filter(function (category) {
		return category && !parseInt(category.parentCid, 10);
	});

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
			var readingUids = uids.filter(function (uid, index) {
				return uid && !isIgnoring[index];
			});
			next(null, readingUids);
		},
	], callback);
};

Categories.async = require('./promisify')(Categories);
