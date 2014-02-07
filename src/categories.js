var db = require('./database'),
	posts = require('./posts'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	topics = require('./topics'),
	plugins = require('./plugins'),
	CategoryTools = require('./categoryTools'),
	meta = require('./meta'),

	async = require('async'),
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
				order: data.order,
				link: "",
				numRecentReplies: 2,
				class: 'col-md-3 col-xs-6',
				imageClass: 'default'
			};

			db.setObject('category:' + cid, category, function(err, data) {
				callback(err, category);
			});
		});
	};

	Categories.getCategoryById = function(category_id, start, end, current_user, callback) {
		Categories.getCategoryData(category_id, function(err, categoryData) {
			if (err) {
				return callback(err);
			}

			function getTopics(next) {
				Categories.getCategoryTopics(category_id, start, end, current_user, next);
			}

			function getActiveUsers(next) {
				Categories.getActiveUsers(category_id, next);
			}

			function getSidebars(next) {
				plugins.fireHook('filter:category.build_sidebars', [], function(err, sidebars) {
					next(err, sidebars);
				});
			}

			function getPageCount(next) {
				Categories.getPageCount(category_id, next);
			}

			async.parallel([getTopics, getActiveUsers, getSidebars, getPageCount], function(err, results) {
				if(err) {
					return callback(err);
				}

				var active_users = results[1],
					sidebars = results[2],
					pageCount = results[3];

				var category = {
					'category_name': categoryData.name,
					'category_description': categoryData.description,
					'link': categoryData.link,
					'disabled': categoryData.disabled || '0',
					'show_sidebar': 'show',
					'show_topic_button': 'inline-block',
					'no_topics_message': 'hidden',
					'topic_row_size': 'col-md-9',
					'category_id': category_id,
					'active_users': [],
					'topics': results[0].topics,
					'nextStart': results[0].nextStart,
					'pageCount': pageCount,
					'disableSocialButtons': meta.config.disableSocialButtons !== undefined ? parseInt(meta.config.disableSocialButtons, 10) !== 0 : false,
					'sidebars': sidebars
				};

				function getModerators(next) {
					Categories.getModerators(category_id, next);
				}

				function getActiveUsers(next) {
					user.getMultipleUserFields(active_users, ['uid', 'username', 'userslug', 'picture'], next);
				}

				if (!category.topics.length) {
					getModerators(function(err, moderators) {
						category.moderators = moderators;
						category.show_sidebar = 'hidden';
						category.no_topics_message = 'show';
						callback(null, category);
					});
				} else {
					async.parallel([getModerators, getActiveUsers], function(err, results) {
						category.moderators = results[0];
						category.active_users = results[1];
						category.show_sidebar = category.topics.length > 0 ? 'show' : 'hidden';
						callback(null, category);
					});
				}

			});
		});
	};

	Categories.getCategoryTopics = function(cid, start, stop, uid, callback) {
		async.waterfall([
			function(next) {
				Categories.getTopicIds(cid, start, stop, next);
			},
			function(tids, next) {
				topics.getTopicsByTids(tids, cid, uid, next);
			},
			function(topics, next) {
				if (topics && topics.length > 0) {
					db.sortedSetRevRank('categories:' + cid + ':tid', topics[topics.length - 1].tid, function(err, rank) {
						if(err) {
							return next(err);
						}

						next(null, {
							topics: topics,
							nextStart: parseInt(rank, 10) + 1
						});
					});
				} else {
					next(null, {
						topics: topics,
						nextStart: 1
					});
				}
			}
		], callback);
	};

	Categories.getTopicIds = function(cid, start, stop, callback) {
		db.getSortedSetRevRange('categories:' + cid + ':tid', start, stop, callback);
	};

	Categories.getPageCount = function(cid, callback) {
		db.sortedSetCard('categories:' + cid + ':tid', function(err, topicCount) {
			if(err) {
				return callback(err);
			}

			var topicsPerPage = parseInt(meta.config.topicsPerPage, 10);
			topicsPerPage = topicsPerPage ? topicsPerPage : 20;

			callback(null, Math.ceil(parseInt(topicCount, 10) / topicsPerPage));
		});
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
					user.getMultipleUserFields(mods, ['uid', 'username', 'userslug', 'picture'], function(err, moderators) {
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

	Categories.markAsUnreadForAll = function(cid, callback) {
		db.delete('cid:' + cid + ':read_by_uid', callback);
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

	Categories.getRecentReplies = function(cid, uid, count, callback) {
		if(count === 0 || !count) {
			return callback(null, []);
		}

		CategoryTools.privileges(cid, uid, function(err, privileges) {
			if (privileges.read) {
				db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, count - 1, function(err, pids) {

					if (err) {
						winston.err(err);
						return callback(err, []);
					}

					if (pids.length === 0) {
						return callback(null, []);
					}

					posts.getPostSummaryByPids(pids, true, function(err, postData) {
						if(err) {
							return callback(err);
						}
						callback(null, postData);
					});
				});
			} else {
				callback(null, []);
			}
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



	Categories.getCategoryData = function(cid, callback) {
		db.exists('category:' + cid, function(err, exists) {
			if (exists) {
				db.getObject('category:' + cid, function(err, data) {
					data.background = data.image ? 'url(' + data.image + ')' : data.bgColor;
					callback(err, data);
				});
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

		db.getSortedSetRange('uid:' + uid + ':posts', 0, -1, function(err, pids) {
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

	Categories.addActiveUser = function(cid, uid, timestamp) {
		if(parseInt(uid, 10)) {
			db.sortedSetAdd('cid:' + cid + ':active_users', timestamp, uid);
		}
	};

	Categories.removeActiveUser = function(cid, uid) {
		db.sortedSetRemove('cid:' + cid + ':active_users', uid);
	};

	Categories.getActiveUsers = function(cid, callback) {
		db.getSortedSetRevRange('cid:' + cid + ':active_users', 0, 15, callback);
	};

	Categories.moveActiveUsers = function(tid, oldCid, cid, callback) {
		function updateUser(uid, timestamp) {
			Categories.addActiveUser(cid, uid, timestamp);
			Categories.isUserActiveIn(oldCid, uid, function(err, active) {

				if (!err && !active) {
					Categories.removeActiveUser(oldCid, uid);
				}
			});
		}

		topics.getTopicField(tid, 'timestamp', function(err, timestamp) {
			if(!err) {
				topics.getUids(tid, function(err, uids) {
					if (!err && uids) {
						for (var i = 0; i < uids.length; ++i) {
							updateUser(uids[i], timestamp);
						}
					}
				});
			}
		});
	};

	Categories.onNewPostMade = function(uid, tid, pid, timestamp) {
		topics.getTopicFields(tid, ['cid', 'pinned'], function(err, topicData) {

			var cid = topicData.cid;

			db.sortedSetAdd('categories:recent_posts:cid:' + cid, timestamp, pid);

			if(parseInt(topicData.pinned, 10) === 0) {
				db.sortedSetAdd('categories:' + cid + ':tid', timestamp, tid);
			}

			Categories.addActiveUser(cid, uid, timestamp);
		});
	}

}(exports));