
'use strict';

var async = require('async'),
	nconf = require('nconf'),

	db = require('./database'),
	user = require('./user'),
	Groups = require('./groups'),
	plugins = require('./plugins'),
	validator = require('validator'),
	privileges = require('./privileges');

(function(Categories) {

	require('./categories/create')(Categories);
	require('./categories/delete')(Categories);
	require('./categories/topics')(Categories);
	require('./categories/unread')(Categories);
	require('./categories/activeusers')(Categories);
	require('./categories/recentreplies')(Categories);
	require('./categories/update')(Categories);

	Categories.exists = function(cid, callback) {
		db.isSortedSetMember('categories:cid', cid, callback);
	};

	Categories.getCategoryById = function(data, callback) {
		Categories.getCategories([data.cid], data.uid, function(err, categories) {
			if (err || !Array.isArray(categories) || !categories[0]) {
				return callback(err || new Error('[[error:invalid-cid]]'));
			}
			var category = categories[0];

			if (parseInt(data.uid, 10)) {
				Categories.markAsRead([data.cid], data.uid);
			}

			async.parallel({
				topics: function(next) {
					Categories.getCategoryTopics(data, next);
				},
				pageCount: function(next) {
					Categories.getPageCount(data.cid, data.uid, next);
				},
				isIgnored: function(next) {
					Categories.isIgnored([data.cid], data.uid, next);
				}
			}, function(err, results) {
				if(err) {
					return callback(err);
				}

				category.topics = results.topics.topics;
				category.nextStart = results.topics.nextStart;
				category.pageCount = results.pageCount;
				category.isIgnored = results.isIgnored[0];

				plugins.fireHook('filter:category.get', {category: category, uid: data.uid}, function(err, data) {
					callback(err, data ? data.category : null);
				});
			});
		});
	};

	Categories.isIgnored = function(cids, uid, callback) {
		user.getIgnoredCategories(uid, function(err, ignoredCids) {
			if (err) {
				return callback(err);
			}

			cids = cids.map(function(cid) {
				return ignoredCids.indexOf(cid.toString()) !== -1;
			});
			callback(null, cids);
		});
	};

	Categories.getPageCount = function(cid, uid, callback) {
		async.parallel({
			topicCount: async.apply(Categories.getCategoryField, cid, 'topic_count'),
			settings: async.apply(user.getSettings, uid)
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!parseInt(results.topicCount, 10)) {
				return callback(null, 1);
			}

			callback(null, Math.ceil(parseInt(results.topicCount, 10) / results.settings.topicsPerPage));
		});
	};

	Categories.getAllCategories = function(uid, callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
			if (err || !Array.isArray(cids) || !cids.length) {
				return callback(err, []);
			}

			Categories.getCategories(cids, uid, callback);
		});
	};

	Categories.getCategoriesByPrivilege = function(uid, privilege, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			},
			function(cids, next) {
				privileges.categories.filterCids(privilege, cids, uid, next);
			},
			function(cids, next) {
				Categories.getCategories(cids, uid, next);
			}
		], callback);
	};

	Categories.getModerators = function(cid, callback) {
		Groups.getMembers('cid:' + cid + ':privileges:mods', 0, -1, function(err, uids) {
			if (err || !Array.isArray(uids) || !uids.length) {
				return callback(err, []);
			}

			user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], callback);
		});
	};

	Categories.getCategoryData = function(cid, callback) {
		Categories.getCategoriesData([cid], function(err, categories) {
			callback(err, categories ? categories[0] : null);
		});
	};

	Categories.getCategoriesData = function(cids, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}
		var keys = cids.map(function(cid) {
			return 'category:' + cid;
		});

		db.getObjects(keys, function(err, categories) {
			if (err || !Array.isArray(categories) || !categories.length) {
				return callback(err, []);
			}

			async.map(categories, modifyCategory, callback);
		});
	};

	function modifyCategory(category, callback) {
		if (!category) {
			return callback(null, null);
		}

		category.name = validator.escape(category.name);
		category.disabled = category.hasOwnProperty('disabled') ? parseInt(category.disabled, 10) === 1 : undefined;
		category.icon = category.icon || 'hidden';
		if (category.hasOwnProperty('post_count')) {
			category.post_count = category.totalPostCount = category.post_count || 0;
		}

		if (category.hasOwnProperty('topic_count')) {
			category.topic_count = category.totalTopicCount = category.topic_count || 0;
		}

		if (category.image) {
			category.backgroundImage = category.image;
		}

		if (category.description) {
			plugins.fireHook('filter:parse.raw', category.description, function(err, parsedDescription) {
				if (err) {
					return callback(err);
				}
				category.descriptionParsed = parsedDescription;
				category.description = validator.escape(category.description);
				callback(null, category);
			});
		} else {
			callback(null, category);
		}
	}

	Categories.getCategoryField = function(cid, field, callback) {
		db.getObjectField('category:' + cid, field, callback);
	};

	Categories.getMultipleCategoryFields = function(cids, fields, callback) {
		if (!Array.isArray(cids) || !cids.length) {
			return callback(null, []);
		}

		var keys = cids.map(function(cid) {
			return 'category:' + cid;
		});

		db.getObjectsFields(keys, fields, function(err, categories) {
			if (err) {
				return callback(err);
			}
			async.map(categories, modifyCategory, callback);
		});
	};

	Categories.getAllCategoryFields = function(fields, callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
			function(cids, next) {
				Categories.getMultipleCategoryFields(cids, fields, next);
			}
		], callback);
	};

	Categories.getCategoryFields = function(cid, fields, callback) {
		db.getObjectFields('category:' + cid, fields, callback);
	};

	Categories.setCategoryField = function(cid, field, value, callback) {
		db.setObjectField('category:' + cid, field, value, callback);
	};

	Categories.incrementCategoryFieldBy = function(cid, field, value, callback) {
		db.incrObjectFieldBy('category:' + cid, field, value, callback);
	};

	Categories.getCategories = function(cids, uid, callback) {
		if (!Array.isArray(cids)) {
			return callback(new Error('[[error:invalid-cid]]'));
		}

		if (!cids.length) {
			return callback(null, []);
		}

		async.parallel({
			categories: function(next) {
				Categories.getCategoriesData(cids, next);
			},
			children: function(next) {
				Categories.getChildren(cids, uid, next);
			},
			parents: function(next) {
				Categories.getParents(cids, next);
			},
			hasRead: function(next) {
				Categories.hasReadCategories(cids, uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var categories = results.categories;
			var hasRead = results.hasRead;
			uid = parseInt(uid, 10);
			for(var i=0; i<results.categories.length; ++i) {
				if (categories[i]) {
					categories[i]['unread-class'] = (parseInt(categories[i].topic_count, 10) === 0 || (hasRead[i] && uid !== 0)) ? '' : 'unread';
					categories[i].children = results.children[i];
					categories[i].parent = results.parents[i] || undefined;
					calculateTopicPostCount(categories[i]);
				}
			}

			callback(null, categories);
		});
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

		category.children.forEach(function(child) {
			postCount += parseInt(child.post_count, 10) || 0;
			topicCount += parseInt(child.topic_count, 10) || 0;
		});
		category.totalPostCount = postCount;
		category.totalTopicCount = topicCount;
	}

	Categories.getParents = function(cids, callback) {
		Categories.getMultipleCategoryFields(cids, ['parentCid'], function(err, data) {
			if (err) {
				return callback(err);
			}

			var parentCids = data.map(function(category) {
				if (category && category.hasOwnProperty('parentCid') && category.parentCid) {
					return category.parentCid;
				} else {
					return 0;
				}
			});

			Categories.getCategoriesData(parentCids, callback);
		});
	};

	Categories.getChildren = function(cids, uid, callback) {
		async.waterfall([
			async.apply(db.getSortedSetRange, 'categories:cid', 0, -1),
			function(cids, next) {
				privileges.categories.filterCids('find', cids, uid, next);
			},
			function (cids, next) {
				Categories.getCategoriesData(cids, next);
			},
			function (categories, next) {
				async.map(cids, function(cid, next) {
					next(null, categories.filter(function(category) {
						return category && parseInt(category.parentCid, 10) === parseInt(cid, 10);
					}));
				}, next);
			}
		], callback);
	};

	/**
	 * Recursively build tree
	 *
	 * @param categories {array} flat list of categories
	 * @param parentCid {number} start from 0 to build full tree
	 */
	Categories.getTree = function(categories, parentCid) {
		var tree = [], i = 0, len = categories.length, category;

		for(i; i < len; ++i) {
			category = categories[i];
			if (!category.hasOwnProperty('parentCid')) {
				category.parentCid = 0;
			}

			if(category.parentCid == parentCid){
				tree.push(category);
				category.children = Categories.getTree(categories, category.cid);
			}
		}

		return tree;
	};

}(exports));
