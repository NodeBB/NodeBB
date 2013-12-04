var db = require('./database.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	async = require('async'),
	topics = require('./topics.js'),
	plugins = require('./plugins'),
	winston = require('winston'),
	nconf = require('nconf');

(function(Categories) {
	"use strict";

	Categories.create = function(data, callback) {
		db.incrObjectField('global', 'nextCid', function(err, cid) {
			if (err) {
				return callback(err, null);
			}

			var slug = cid + '/' + utils.slugify(data.name);
			db.listAppend('categories:cid', cid);

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
				order: data.order
			};

			db.setObject('category:' + cid, category, function(err, data) {
				callback(err, category);
			});
		});
	};

	Categories.getCategoryById = function(category_id, current_user, callback) {
		Categories.getCategoryData(category_id, function(err, categoryData) {
			if (err) {
				return callback(err);
			}

			var category_name = categoryData.name,
				category_slug = categoryData.slug,
				disabled = categoryData.disabled || '0',
				category_description = categoryData.description;

			function getTopicIds(next) {
				Categories.getTopicIds(category_id, 0, 19, next);
			}

			function getActiveUsers(next) {
				Categories.getActiveUsers(category_id, next);
			}

			function getSidebars(next) {
				plugins.fireHook('filter:category.build_sidebars', [], function(err, sidebars) {
					next(err, sidebars);
				});
			}

			async.parallel([getTopicIds, getActiveUsers, getSidebars], function(err, results) {
				var tids = results[0],
					active_users = results[1],
					sidebars = results[2];

				var categoryData = {
					'category_name': category_name,
					'category_description': category_description,
					'disabled': disabled,
					'show_sidebar': 'show',
					'show_topic_button': 'inline-block',
					'no_topics_message': 'hidden',
					'topic_row_size': 'col-md-9',
					'category_id': category_id,
					'active_users': [],
					'topics': [],
					'twitter-intent-url': 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(nconf.get('url') + 'category/' + category_slug) + '&text=' + encodeURIComponent(category_name),
					'facebook-share-url': 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(nconf.get('url') + 'category/' + category_slug),
					'google-share-url': 'https://plus.google.com/share?url=' + encodeURIComponent(nconf.get('url') + 'category/' + category_slug),
					'sidebars': sidebars
				};

				function getTopics(next) {
					topics.getTopicsByTids(tids, current_user, function(topicsData) {
						next(null, topicsData);
					}, category_id);
				}

				function getModerators(next) {
					Categories.getModerators(category_id, next);
				}

				function getActiveUsers(next) {
					user.getMultipleUserFields(active_users, ['uid', 'username', 'userslug', 'picture'], function(err, users) {
						next(err, users);
					});
				}

				if (tids.length === 0) {
					getModerators(function(err, moderators) {
						categoryData.moderator_block_class = moderators.length > 0 ? '' : 'none';
						categoryData.moderators = moderators;
						categoryData.show_sidebar = 'hidden';
						categoryData.no_topics_message = 'show';
						callback(null, categoryData);
					});
				} else {
					async.parallel([getTopics, getModerators, getActiveUsers], function(err, results) {
						categoryData.topics = results[0];
						categoryData.moderator_block_class = results[1].length > 0 ? '' : 'none';
						categoryData.moderators = results[1];
						categoryData.active_users = results[2];
						categoryData.show_sidebar = categoryData.topics.length > 0 ? 'show' : 'hidden';
						callback(null, categoryData);
					});
				}

			});
		});
	};

	Categories.getCategoryTopics = function(cid, start, stop, uid, callback) {
		Categories.getTopicIds(cid, start, stop, function(err, tids) {
			topics.getTopicsByTids(tids, uid, function(topicsData) {
				callback(topicsData);
			}, cid);
		});
	};

	Categories.getTopicIds = function(cid, start, stop, callback) {
		db.getSortedSetRevRange('categories:' + cid + ':tid', start, stop, callback);
	};

	Categories.getActiveUsers = function(cid, callback) {
		db.getSetMembers('cid:' + cid + ':active_users', callback);
	};

	Categories.getAllCategories = function(current_user, callback) {
		db.getListRange('categories:cid', 0, -1, function(err, cids) {
			if(err) {
				return callback(err);
			}
			if(cids && cids.length === 0) {
				return callback(null, {categories : []});
			}

			Categories.getCategories(cids, current_user, callback);
		});
	};

	Categories.getModerators = function(cid, callback) {
		db.getSetMembers('cid:' + cid + ':moderators', function(err, mods) {
			if (!err) {
				if (mods && mods.length) {
					user.getMultipleUserFields(mods, ['username'], function(err, moderators) {
						callback(err, moderators);
					});
				} else {
					callback(null, []);
				}
			} else {
				callback(err, null);
			}

		});
	};

	Categories.isTopicsRead = function(cid, uid, callback) {
		db.getSortedSetRange('categories:' + cid + ':tid', 0, -1, function(err, tids) {

			topics.hasReadTopics(tids, uid, function(hasRead) {

				var allread = true;
				for (var i = 0, ii = tids.length; i < ii; i++) {
					if (hasRead[i] === 0) {
						allread = false;
						break;
					}
				}
				callback(allread);
			});
		});
	};

	Categories.markAsRead = function(cid, uid) {
		db.setAdd('cid:' + cid + ':read_by_uid', uid);
	};

	Categories.hasReadCategories = function(cids, uid, callback) {

		var sets = [];

		for (var i = 0, ii = cids.length; i < ii; i++) {
			sets.push('cid:' + cids[i] + ':read_by_uid');
		}

		db.isMemberOfSets(sets, uid, function(err, hasRead) {
			callback(hasRead);
		});
	};

	Categories.hasReadCategory = function(cid, uid, callback) {
		db.isSetMember('cid:' + cid + ':read_by_uid', uid, function(err, hasRead) {
			if(err) {
				return callback(false);
			}

			callback(hasRead);
		});
	};

	Categories.getRecentReplies = function(cid, count, callback) {
		db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, (count < 10) ? 10 : count, function(err, pids) {

			if (err) {
				winston.err(err);
				callback([]);
				return;
			}

			if (pids.length === 0) {
				callback([]);
				return;
			}

			posts.getPostSummaryByPids(pids, function(err, postData) {
				if (postData.length > count) {
					postData = postData.slice(0, count);
				}
				callback(postData);
			});
		});
	};

	Categories.moveRecentReplies = function(tid, oldCid, cid, callback) {
		function movePost(pid, callback) {
			posts.getPostField(pid, 'timestamp', function(err, timestamp) {
				if(err) {
					return callback(err);
				}

				db.sortedSetRemove('categories:recent_posts:cid:' + oldCid, pid);
				db.sortedSetAdd('categories:recent_posts:cid:' + cid, timestamp, pid);
				callback(null);
			});
		}

		topics.getPids(tid, function(err, pids) {
			if(err) {
				return callback(err, null);
			}

			async.each(pids, movePost, function(err) {
				if(err) {
					return callback(err, null);
				}
				callback(null, 1);
			});
		});
	};

	Categories.moveActiveUsers = function(tid, oldCid, cid, callback) {
		function updateUser(uid) {
			Categories.addActiveUser(cid, uid);
			Categories.isUserActiveIn(oldCid, uid, function(err, active) {

				if (!err && !active) {
					Categories.removeActiveUser(oldCid, uid);
				}
			});
		}

		topics.getUids(tid, function(err, uids) {
			if (!err && uids) {
				for (var i = 0; i < uids.length; ++i) {
					updateUser(uids[i]);
				}
			}
		});
	};

	Categories.getCategoryData = function(cid, callback) {
		db.exists('category:' + cid, function(err, exists) {
			if (exists) {
				db.getObject('category:' + cid, callback);
			} else {
				callback(new Error('No category found!'));
			}
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
		if (!cids || !Array.isArray(cids) || cids.length === 0) {
			return callback(new Error('invalid-cids'), null);
		}

		function getCategory(cid, callback) {
			Categories.getCategoryData(cid, function(err, categoryData) {
				if (err) {
					winston.warn('Attempted to retrieve cid ' + cid + ', but nothing was returned!');
					return callback(err, null);
				}

				Categories.hasReadCategory(cid, uid, function(hasRead) {
					categoryData.badgeclass = (parseInt(categoryData.topic_count, 10) === 0 || (hasRead && uid !== 0)) ? '' : 'badge-important';

					callback(null, categoryData);
				});
			});
		}

		async.map(cids, getCategory, function(err, categories) {
			if (err) {
				winston.err(err);
				return callback(err, null);
			}

			categories = categories.filter(function(category) {
				return !!category;
			}).sort(function(a, b) {
				return parseInt(a.order, 10) - parseInt(b.order, 10);
			});

			callback(null, {
				'categories': categories
			});
		});

	};

	Categories.isUserActiveIn = function(cid, uid, callback) {

		db.getListRange('uid:' + uid + ':posts', 0, -1, function(err, pids) {
			if (err) {
				return callback(err, null);
			}

			var index = 0,
				active = false;

			async.whilst(
				function() {
					return active === false && index < pids.length;
				},
				function(callback) {
					posts.getCidByPid(pids[index], function(err, postCid) {
						if (err) {
							return callback(err);
						}

						if (postCid === cid) {
							active = true;
						}

						++index;
						callback(null);
					});
				},
				function(err) {
					if (err) {
						return callback(err, null);
					}

					callback(null, active);
				}
			);
		});
	};

	Categories.addActiveUser = function(cid, uid) {
		if(parseInt(uid, 10)) {
			db.setAdd('cid:' + cid + ':active_users', uid);
		}
	};

	Categories.removeActiveUser = function(cid, uid) {
		db.setRemove('cid:' + cid + ':active_users', uid);
	};

}(exports));