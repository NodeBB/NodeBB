
'use strict';

var db = require('./database'),
	posts = require('./posts'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	Groups = require('./groups'),
	topics = require('./topics'),
	plugins = require('./plugins'),
	meta = require('./meta'),
	emitter = require('./emitter'),
	validator = require('validator'),

	async = require('async'),
	winston = require('winston'),
	nconf = require('nconf');

(function(Categories) {

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
				topic_count: 0,
				disabled: 0,
				order: data.order,
				link: '',
				numRecentReplies: 2,
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
		Categories.getCategoryData(cid, function(err, category) {
			if(err || !category) {
				return callback(err || new Error('[[error:invalid-cid]]'));
			}

			if(parseInt(uid, 10)) {
				Categories.markAsRead(cid, uid);
			}

			async.parallel({
				topics: function(next) {
					Categories.getCategoryTopics(cid, start, end, uid, next);
				},
				pageCount: function(next) {
					Categories.getPageCount(cid, uid, next);
				}
			}, function(err, results) {
				if(err) {
					return callback(err);
				}

				category.topics = results.topics.topics;
				category.nextStart = results.topics.nextStart;
				category.pageCount = results.pageCount;
				category.topic_row_size = 'col-md-9';

				callback(null, category);
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
				if (!topics || !topics.length) {
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

				db.sortedSetRevRank('categories:' + cid + ':tid', topics[topics.length - 1].tid, function(err, rank) {
					if(err) {
						return next(err);
					}

					next(null, {
						topics: topics,
						nextStart: parseInt(rank, 10) + 1
					});
				});
			}
		], callback);
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
		db.sortedSetCard('categories:' + cid + ':tid', function(err, topicCount) {
			if(err) {
				return callback(err);
			}

			if (parseInt(topicCount, 10) === 0) {
				return callback(null, 1);
			}

			user.getSettings(uid, function(err, settings) {
				if(err) {
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
				return callback(null, {categories : []});
			}

			Categories.getCategories(cids, uid, callback);
		});
	};

	Categories.getModerators = function(cid, callback) {
		Groups.get('cid:' + cid + ':privileges:mods', {}, function(err, groupObj) {
			if (!err) {
				if (groupObj.members && groupObj.members.length) {
					user.getMultipleUserFields(groupObj.members, ['uid', 'username', 'userslug', 'picture'], function(err, moderators) {
						callback(err, moderators);
					});
				} else {
					callback(null, []);
				}
			} else {
				// Probably no mods
				callback(null, []);
			}
		});
	};

	Categories.markAsRead = function(cid, uid, callback) {
		db.setAdd('cid:' + cid + ':read_by_uid', uid, callback);
	};

	Categories.markAsUnreadForAll = function(cid, callback) {
		db.delete('cid:' + cid + ':read_by_uid', function(err) {
			if(typeof callback === 'function') {
				callback(err);
			}
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
			return 'category:'+cid;
		});

		db.getObjects(keys, function(err, categories) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(categories)) {
				return callback(null, []);
			}

			for (var i=0; i<categories.length; ++i) {
				if (categories[i]) {
					categories[i].name = validator.escape(categories[i].name);
					categories[i].description = validator.escape(categories[i].description);
					categories[i].backgroundImage = categories[i].image ? nconf.get('relative_path') + categories[i].image : '';
					categories[i].disabled = categories[i].disabled ? parseInt(categories[i].disabled, 10) !== 0 : false;
				}
			}
			callback(null, categories);
		});
	};

	Categories.getCategoryField = function(cid, field, callback) {
		db.getObjectField('category:' + cid, field, callback);
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

		if (!Array.isArray(cids) || cids.length === 0) {
			return callback(new Error('[[error:invalid-cid]]'));
		}

		async.parallel({
			categories: function(next) {
				Categories.getCategoriesData(cids, next);
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
				categories[i]['unread-class'] = (parseInt(categories[i].topic_count, 10) === 0 || (hasRead[i] && uid !== 0)) ? '' : 'unread';
			}

			callback(null, {categories: categories});
		});
	};

	Categories.onNewPostMade = function(postData) {
		topics.getTopicFields(postData.tid, ['cid', 'pinned'], function(err, topicData) {
			if (err) {
				winston.error(err.message);
			}

			var cid = topicData.cid;

			db.sortedSetAdd('categories:recent_posts:cid:' + cid, postData.timestamp, postData.pid);

			if(parseInt(topicData.pinned, 10) === 0) {
				db.sortedSetAdd('categories:' + cid + ':tid', postData.timestamp, postData.tid);
			}
		});
	};

	emitter.on('event:newpost', Categories.onNewPostMade);

}(exports));
