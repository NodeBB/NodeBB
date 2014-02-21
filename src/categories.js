var db = require('./database'),
	posts = require('./posts'),
	utils = require('./../public/src/utils'),
	user = require('./user'),
	Groups = require('./groups'),
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
				background: data.bgColor,
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

	Categories.getCategoryById = function(cid, start, end, uid, callback) {

		if(parseInt(uid, 10)) {
			Categories.markAsRead(cid, uid);
		}

		function getCategoryData(next) {
			Categories.getCategoryData(cid, next);
		}

		function getTopics(next) {
			Categories.getCategoryTopics(cid, start, end, uid, next);
		}

		function getPageCount(next) {
			Categories.getPageCount(cid, uid, next);
		}

		async.parallel({
			'category': getCategoryData,
			'topics': getTopics,
			'pageCount': getPageCount
		}, function(err, results) {
			if(err) {
				return callback(err);
			}

			var category = {
				'category_name': results.category.name,
				'category_description': results.category.description,
				'link': results.category.link,
				'disabled': results.category.disabled,
				'topic_row_size': 'col-md-9',
				'category_id': cid,
				'topics': results.topics.topics,
				'nextStart': results.topics.nextStart,
				'pageCount': results.pageCount,
				'disableSocialButtons': meta.config.disableSocialButtons !== undefined ? parseInt(meta.config.disableSocialButtons, 10) !== 0 : false,
			};

			callback(null, category);
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

	Categories.getPageCount = function(cid, uid, callback) {
		db.sortedSetCard('categories:' + cid + ':tid', function(err, topicCount) {
			if(err) {
				return callback(err);
			}

			user.getSettings(uid, function(err, settings) {
				if(err) {
					return callback(err);
				}

				callback(null, Math.ceil(parseInt(topicCount, 10) / settings.topicsPerPage));
			});
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
		Groups.getByGroupName('cid:' + cid + ':privileges:mods', {}, function(err, groupObj) {
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

	Categories.markAsRead = function(cid, uid) {
		db.setAdd('cid:' + cid + ':read_by_uid', uid);
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
			if(err) {
				return callback(err);
			}

			if (!privileges.read) {
				return callback(null, []);
			}

			db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, count - 1, function(err, pids) {
				if (err) {
					return callback(err, []);
				}

				if (!pids || !pids.length) {
					return callback(null, []);
				}

				posts.getPostSummaryByPids(pids, true, callback);
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
				callback();
			});
		}

		topics.getPids(tid, function(err, pids) {
			if(err) {
				return callback(err);
			}

			async.each(pids, movePost, callback);
		});
	};

	Categories.getCategoryData = function(cid, callback) {
		db.exists('category:' + cid, function(err, exists) {
			if (exists) {
				db.getObject('category:' + cid, function(err, data) {
					data.background = data.image ? 'url(' + data.image + ')' : data.bgColor;
					data.disabled = data.disabled ? parseInt(data.disabled, 10) !== 0 : false;
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

					categoryData['unread-class'] = (parseInt(categoryData.topic_count, 10) === 0 || (hasRead && parseInt(uid, 10) !== 0)) ? '' : 'unread';

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
		db.getSortedSetRevRange('cid:' + cid + ':active_users', 0, 23, callback);
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