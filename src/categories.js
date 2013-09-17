var RDB = require('./redis.js'),
	posts = require('./posts.js'),
	utils = require('./../public/src/utils.js'),
	user = require('./user.js'),
	async = require('async'),
	topics = require('./topics.js'),
	winston = require('winston');

(function(Categories) {

	Categories.create = function(data, callback) {
		RDB.incr('global:next_category_id', function(err, cid) {
			if (err)
				return callback(err, null);

			var slug = cid + '/' + utils.slugify(data.name);
			RDB.rpush('categories:cid', cid);

			var category = {
				cid: cid,
				name: data.name,
				description: data.description,
				icon: data.icon,
				blockclass: data.blockclass,
				slug: slug,
				topic_count: 0,
				disabled: 0
			};
			RDB.hmset('category:' + cid, category);

			RDB.set('categoryslug:' + slug + ':cid', cid);

			callback(null, category);
		});
	};

	Categories.getCategoryById = function(category_id, current_user, callback) {

		Categories.getCategoryData(category_id, function(err, categoryData) {
			if (err) return callback(err);

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

			async.parallel([getTopicIds, getActiveUsers], function(err, results) {
				var tids = results[0],
					active_users = results[1];

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
					'google-share-url': 'https://plus.google.com/share?url=' + encodeURIComponent(nconf.get('url') + 'category/' + category_slug)
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
					user.getMultipleUserFields(active_users, ['username', 'userslug', 'picture'], function(err, users) {
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
		RDB.zrevrange('categories:' + cid + ':tid', start, stop, callback);
	};

	Categories.getActiveUsers = function(cid, callback) {
		RDB.smembers('cid:' + cid + ':active_users', callback);
	};

	Categories.getAllCategories = function(callback, current_user) {
		RDB.lrange('categories:cid', 0, -1, function(err, cids) {
			RDB.handle(err);
			Categories.getCategories(cids, callback, current_user);
		});
	};

	Categories.getModerators = function(cid, callback) {
		RDB.smembers('cid:' + cid + ':moderators', function(err, mods) {
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


	Categories.privileges = function(cid, uid, callback) {
		function isModerator(next) {
			user.isModerator(uid, cid, function(isMod) {
				next(null, isMod);
			});
		}

		function isAdministrator(next) {
			user.isAdministrator(uid, function(isAdmin) {
				next(null, isAdmin);
			});
		}

		async.parallel([isModerator, isAdministrator], function(err, results) {
			callback({
				editable: results.indexOf(true) !== -1 ? true : false,
				view_deleted: results.indexOf(true) !== -1 ? true : false
			});
		});
	};

	Categories.isTopicsRead = function(cid, uid, callback) {
		RDB.zrange('categories:' + cid + ':tid', 0, -1, function(err, tids) {

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
		RDB.sadd('cid:' + cid + ':read_by_uid', uid);
	};

	Categories.hasReadCategories = function(cids, uid, callback) {
		var batch = RDB.multi();

		for (var i = 0, ii = cids.length; i < ii; i++) {
			batch.sismember('cid:' + cids[i] + ':read_by_uid', uid);
		}

		batch.exec(function(err, hasRead) {
			callback(hasRead);
		});
	};

	Categories.hasReadCategory = function(cid, uid, callback) {
		RDB.sismember('cid:' + cid + ':read_by_uid', uid, function(err, hasRead) {
			RDB.handle(err);

			callback(hasRead);
		});
	};

	Categories.getRecentReplies = function(cid, count, callback) {
		RDB.zrevrange('categories:recent_posts:cid:' + cid, 0, (count < 10) ? 10 : count, function(err, pids) {

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
			posts.getPostField(pid, 'timestamp', function(timestamp) {
				RDB.zrem('categories:recent_posts:cid:' + oldCid, pid);
				RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid);
			});
		}

		topics.getPids(tid, function(err, pids) {
			if (!err) {
				async.each(pids, movePost, function(err) {
					if (!err) {
						callback(null, 1);
					} else {
						winston.err(err);
						callback(err, null);
					}
				});
			} else {
				winston.err(err);
				callback(err, null);
			}
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
		RDB.exists('category:' + cid, function(err, exists) {
			if (exists) RDB.hgetall('category:' + cid, callback);
			else callback(new Error('No category found!'));
		});
	};

	Categories.getCategoryField = function(cid, field, callback) {
		RDB.hget('category:' + cid, field, callback);
	};

	Categories.getCategoryFields = function(cid, fields, callback) {
		RDB.hmgetObject('category:' + cid, fields, function(err, data) {
			if (err === null)
				callback(data);
			else
				winston.err(err);
		});
	};

	Categories.setCategoryField = function(cid, field, value) {
		RDB.hset('category:' + cid, field, value);
	};

	Categories.incrementCategoryFieldBy = function(cid, field, value) {
		RDB.hincrby('category:' + cid, field, value);
	};

	Categories.getCategories = function(cids, callback, current_user) {
		if (!cids || !Array.isArray(cids) || cids.length === 0) {
			callback({
				'categories': []
			});
			return;
		}

		var categories = [];

		function getCategory(cid, callback) {
			Categories.getCategoryData(cid, function(err, categoryData) {

				if (err) {
					callback(err);
					return;
				}

				Categories.hasReadCategory(cid, current_user, function(hasRead) {
					categoryData['badgeclass'] = (parseInt(categoryData.topic_count, 10) === 0 || (hasRead && current_user != 0)) ? '' : 'badge-important';

					categories.push(categoryData);
					callback(null);
				});
			});
		}

		async.eachSeries(cids, getCategory, function(err) {
			if (err) {
				winston.err(err);
				callback(null);
				return;
			}

			callback({
				'categories': categories
			});
		});

	};

	Categories.isUserActiveIn = function(cid, uid, callback) {

		RDB.lrange('uid:' + uid + ':posts', 0, -1, function(err, pids) {
			if (err)
				return callback(err, null);

			function getPostCategory(pid, callback) {
				posts.getPostField(pid, 'tid', function(tid) {

					topics.getTopicField(tid, 'cid', function(err, postCid) {
						if (err)
							return callback(err, null);

						return callback(null, postCid);
					});
				});
			}

			var index = 0,
				active = false;

			async.whilst(
				function() {
					return active === false && index < pids.length;
				},
				function(callback) {
					getPostCategory(pids[index], function(err, postCid) {
						if (err)
							return callback(err);
						if (postCid === cid)
							active = true;
						++index;
						callback(null);
					});
				},
				function(err) {
					if (err)
						return callback(err, null);

					callback(null, active);
				}
			);
		});
	};

	Categories.addActiveUser = function(cid, uid) {
		RDB.sadd('cid:' + cid + ':active_users', uid);
	};

	Categories.removeActiveUser = function(cid, uid) {
		RDB.srem('cid:' + cid + ':active_users', uid);
	};

}(exports));