
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
					Categories.getCategoryTopics({
						cid: data.cid,
						set: data.set,
						reverse: data.reverse,
						start: data.start,
						stop: data.end,
						uid: data.uid
					}, next);
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
				category.topic_row_size = 'col-md-9';

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
			},
			function(categories, next) {
				categories = categories.filter(function(category) {
					return !category.disabled;
				});
				next(null, categories);
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
		category.disabled = parseInt(category.disabled, 10) === 1;
		category.icon = category.icon || 'hidden';
		if (category.hasOwnProperty('post_count')) {
			category.post_count = category.post_count || 0;
		}

		if (category.description) {
			category.description = validator.escape(category.description);
		}

		if (category.image) {
			category.backgroundImage = category.image;
		}

		callback(null, category);
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
					categories[i].parent = results.parents[i] && !results.parents[i].disabled ? results.parents[i] : null;
				}
			}

			callback(null, categories);
		});
	};

	Categories.getParents = function(cids, callback) {
		Categories.getMultipleCategoryFields(cids, ['parentCid'], function(err, data) {
			if (err) {
				return callback(err);
			}

			var parentCids = data.map(function(category) {
				return category && category.parentCid;
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
				// Filter categories to isolate children, and remove disabled categories
				async.map(cids, function(cid, next) {
					next(null, categories.filter(function(category) {
						return category && parseInt(category.parentCid, 10) === parseInt(cid, 10) && !category.disabled;
					}));
				}, next);
			}
		], callback);
	};

}(exports));
