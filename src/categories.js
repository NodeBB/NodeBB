
'use strict';

var db = require('./database'),
	posts = require('./posts'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	Groups = require('./groups'),
	topics = require('./topics'),
	plugins = require('./plugins'),
	meta = require('./meta'),
	validator = require('validator'),
	privileges = require('./privileges'),

	async = require('async'),
	winston = require('winston'),
	nconf = require('nconf');

(function(Categories) {

	require('./categories/delete')(Categories);
	require('./categories/activeusers')(Categories);
	require('./categories/recentreplies')(Categories);
	require('./categories/update')(Categories);

	Categories.create = function(data, callback) {
		db.incrObjectField('global', 'nextCid', function(err, cid) {
			if (err) {
				return callback(err);
			}

			var slug = cid + '/' + utils.slugify(data.name);

			var category = {
				cid: cid,
				name: data.name,
				description: data.description,
				icon: data.icon,
				bgColor: data.bgColor,
				color: data.color,
				slug: slug,
				parentCid: 0,
				topic_count: 0,
				post_count: 0,
				disabled: 0,
				order: data.order,
				link: '',
				numRecentReplies: 1,
				class: 'col-md-3 col-xs-6',
				imageClass: 'auto'
			};

			db.setObject('category:' + cid, category, function(err) {
				if(err) {
					return callback(err);
				}

				db.sortedSetAdd('categories:cid', data.order, cid);

				callback(null, category);
			});
		});
	};

	Categories.exists = function(cid, callback) {
		db.isSortedSetMember('categories:cid', cid, callback);
	};

	Categories.getCategoryById = function(cid, start, end, uid, callback) {
		Categories.getCategories([cid], uid, function(err, categories) {
			if (err || !Array.isArray(categories) || !categories[0]) {
				return callback(err || new Error('[[error:invalid-cid]]'));
			}
			var category = categories[0];

			if (parseInt(uid, 10)) {
				Categories.markAsRead([cid], uid);
			}

			async.parallel({
				topics: function(next) {
					Categories.getCategoryTopics(cid, start, end, uid, next);
				},
				pageCount: function(next) {
					Categories.getPageCount(cid, uid, next);
				},
				isIgnored: function(next) {
					Categories.isIgnored([cid], uid, next);
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

				plugins.fireHook('filter:category.get', category, uid, callback);
			});
		});
	};

	Categories.getCategoryTopics = function(cid, start, stop, uid, callback) {
		var tids;
		async.waterfall([
			function(next) {
				Categories.getTopicIds(cid, start, stop, next);
			},
			function(topicIds, next) {
				tids = topicIds;
				topics.getTopicsByTids(tids, uid, next);
			},
			function(topics, next) {
				if (!Array.isArray(topics) || !topics.length) {
					return next(null, {
						topics: [],
						nextStart: 1
					});
				}

				var indices = {},
					i = 0;
				for(i=0; i<tids.length; ++i) {
					indices[tids[i]] = start + i;
				}

				for(i=0; i<topics.length; ++i) {
					topics[i].index = indices[topics[i].tid];
				}

				next(null, {
					topics: topics,
					nextStart: stop + 1
				});
			}
		], callback);
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

	Categories.getTopicIds = function(cid, start, stop, callback) {
		db.getSortedSetRevRange('categories:' + cid + ':tid', start, stop, callback);
	};

	Categories.getTopicIndex = function(tid, callback) {
		topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			db.sortedSetRevRank('categories:' + cid + ':tid', tid, callback);
		});
	};

	Categories.getPageCount = function(cid, uid, callback) {
		Categories.getCategoryField(cid, 'topic_count', function(err, topicCount) {
			if (err) {
				return callback(err);
			}

			if (parseInt(topicCount, 10) === 0) {
				return callback(null, 1);
			}

			user.getSettings(uid, function(err, settings) {
				if (err) {
					return callback(err);
				}

				callback(null, Math.ceil(parseInt(topicCount, 10) / settings.topicsPerPage));
			});
		});
	};

	Categories.getAllCategories = function(uid, callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(cids) || !cids.length) {
				return callback(null, []);
			}

			Categories.getCategories(cids, uid, callback);
		});
	};

	Categories.getCategoriesByPrivilege = function(uid, privilege, callback) {
		db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(cids) || !cids.length) {
				return callback(null, []);
			}

			privileges.categories.filterCids(privilege, cids, uid, function(err, cids) {
				if (err) {
					return callback(err);
				}

				Categories.getCategories(cids, uid, function(err, categories) {
					if (err) {
						return callback(err);
					}

					categories = categories.filter(function(category) {
						return !category.disabled;
					});

					callback(null, categories);
				});
			});
		});
	};

	Categories.getModerators = function(cid, callback) {
		Groups.get('cid:' + cid + ':privileges:mods', {}, function(err, groupObj) {
			if (err && err === 'group-not-found') {
				return callback(null, []);
			}
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(groupObj) || !groupObj.members.length) {
				return callback(null, []);
			}

			user.getMultipleUserFields(groupObj.members, ['uid', 'username', 'userslug', 'picture'], callback);
		});
	};

	Categories.markAsRead = function(cids, uid, callback) {
		callback = callback || function() {};
		if (!Array.isArray(cids) || !cids.length) {
			return callback();
		}
		var keys = cids.map(function(cid) {
			return 'cid:' + cid + ':read_by_uid';
		});

		db.isMemberOfSets(keys, uid, function(err, hasRead) {
			if (err) {
				return callback(err);
			}

			keys = keys.filter(function(key, index) {
				return !hasRead[index];
			});

			if (!keys.length) {
				return callback();
			}

			db.setsAdd(keys, uid, callback);
		});
	};

	Categories.markAsUnreadForAll = function(cid, callback) {
		callback = callback || function() {};
		db.delete('cid:' + cid + ':read_by_uid', function(err) {
			callback(err);
		});
	};

	Categories.hasReadCategories = function(cids, uid, callback) {
		var sets = [];

		for (var i = 0, ii = cids.length; i < ii; i++) {
			sets.push('cid:' + cids[i] + ':read_by_uid');
		}

		db.isMemberOfSets(sets, uid, callback);
	};

	Categories.hasReadCategory = function(cid, uid, callback) {
		db.isSetMember('cid:' + cid + ':read_by_uid', uid, callback);
	};

	Categories.getCategoryData = function(cid, callback) {
		Categories.getCategoriesData([cid], function(err, categories) {
			callback(err, categories ? categories[0] : null);
		});
	};

	Categories.getCategoriesData = function(cids, callback) {
		var keys = cids.map(function(cid) {
			return 'category:' + cid;
		});

		db.getObjects(keys, function(err, categories) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(categories) || !categories.length) {
				return callback(null, []);
			}

			async.map(categories, function(category, next) {
				if (!category) {
					return next(null, category);
				}
				category.name = validator.escape(category.name);
				category.description = validator.escape(category.description);
				category.backgroundImage = category.image ? nconf.get('relative_path') + category.image : '';
				category.disabled = parseInt(category.disabled, 10) === 1;

				next(null, category);
			}, callback);
		});
	};

	Categories.getCategoryField = function(cid, field, callback) {
		db.getObjectField('category:' + cid, field, callback);
	};

	Categories.getMultipleCategoryFields = function(cids, fields, callback) {
		var keys = cids.map(function(cid) {
			return 'category:' + cid;
		});
		db.getObjectsFields(keys, fields, callback);
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
		var keys = cids.map(function(cid) {
			return 'category:' + cid;
		});

		db.getObjectsFields(keys, ['parentCid'], function(err, data) {
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
						return parseInt(category.parentCid, 10) === parseInt(cid, 10) && !category.disabled;
					}));
				}, next);
			}
		], callback);
	};

	Categories.onNewPostMade = function(postData, callback) {
		topics.getTopicFields(postData.tid, ['cid', 'pinned'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			if (!topicData || !topicData.cid) {
				return callback();
			}

			var cid = topicData.cid;

			async.parallel([
				function(next) {
					db.sortedSetAdd('categories:recent_posts:cid:' + cid, postData.timestamp, postData.pid, next);
				},
				function(next) {
					db.incrObjectField('category:' + cid, 'post_count', next);
				},
				function(next) {
					if (parseInt(topicData.pinned, 10) === 1) {
						next();
					} else {
						db.sortedSetAdd('categories:' + cid + ':tid', postData.timestamp, postData.tid, next);
					}
				}
			], callback);
		});
	};


}(exports));
