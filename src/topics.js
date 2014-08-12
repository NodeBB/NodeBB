"use strict";

var async = require('async'),
	validator = require('validator'),

	db = require('./database'),
	posts = require('./posts'),
	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	user = require('./user'),
	categories = require('./categories'),
	privileges = require('./privileges');

(function(Topics) {

	require('./topics/create')(Topics);
	require('./topics/delete')(Topics);
	require('./topics/unread')(Topics);
	require('./topics/recent')(Topics);
	require('./topics/popular')(Topics);
	require('./topics/fork')(Topics);
	require('./topics/posts')(Topics);
	require('./topics/follow')(Topics);
	require('./topics/tags')(Topics);

	Topics.getTopicData = function(tid, callback) {
		Topics.getTopicsData([tid], function(err, topics) {
			callback(err, Array.isArray(topics) && topics.length ? topics[0] : null);
		});
	};

	Topics.getTopicsData = function(tids, callback) {
		var keys = [];

		for (var i=0; i<tids.length; ++i) {
			keys.push('topic:' + tids[i]);
		}

		db.getObjects(keys, function(err, topics) {
			if (err) {
				return callback(err);
			}

			for (var i=0; i<tids.length; ++i) {
				if(topics[i]) {
					topics[i].title = validator.escape(topics[i].title);
					topics[i].relativeTime = utils.toISOString(topics[i].timestamp);
				}
			}

			callback(null, topics);
		});
	};

	Topics.getTopicDataWithUser = function(tid, callback) {
		Topics.getTopicData(tid, function(err, topic) {
			if (err || !topic) {
				return callback(err || new Error('[[error:no-topic]]'));
			}

			user.getUserFields(topic.uid, ['username', 'userslug', 'picture'], function(err, userData) {
				if (err) {
					return callback(err);
				}

				topic.user = userData;
				callback(null, topic);
			});
		});
	};

	Topics.getPageCount = function(tid, uid, callback) {
		db.sortedSetCard('tid:' + tid + ':posts', function(err, postCount) {
			if(err) {
				return callback(err);
			}
			if(!parseInt(postCount, 10)) {
				return callback(null, 1);
			}
			user.getSettings(uid, function(err, settings) {
				if(err) {
					return callback(err);
				}

				callback(null, Math.ceil(parseInt(postCount, 10) / settings.postsPerPage));
			});
		});
	};

	Topics.getTidPage = function(tid, uid, callback) {
		if(!tid) {
			return callback(new Error('[[error:invalid-tid]]'));
		}

		async.parallel({
			index: function(next) {
				categories.getTopicIndex(tid, next);
			},
			settings: function(next) {
				user.getSettings(uid, next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}
			callback(null, Math.ceil((results.index + 1) / results.settings.topicsPerPage));
		});
	};

	Topics.getCategoryData = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
	};

	Topics.getTopics = function(set, uid, tids, callback) {
		var returnTopics = {
			topics: [],
			nextStart: 0
		};

		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, returnTopics);
		}

		privileges.topics.filter('read', tids, uid, function(err, tids) {
			if (err) {
				return callback(err);
			}

			Topics.getTopicsByTids(tids, uid, function(err, topicData) {
				if(err) {
					return callback(err);
				}

				if(!topicData || !topicData.length) {
					return callback(null, returnTopics);
				}

				db.sortedSetRevRank(set, topicData[topicData.length - 1].tid, function(err, rank) {
					if(err) {
						return callback(err);
					}

					returnTopics.nextStart = parseInt(rank, 10) + 1;
					returnTopics.topics = topicData;
					callback(null, returnTopics);
				});
			});
		});
	};

	Topics.getTopicsFromSet = function(uid, set, start, end, callback) {
		db.getSortedSetRevRange(set, start, end, function(err, tids) {
			if(err) {
				return callback(err);
			}

			Topics.getTopics(set, uid, tids, callback);
		});
	};

	Topics.getTopicsByTids = function(tids, uid, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		Topics.getTopicsData(tids, function(err, topics) {
			function mapFilter(array, field) {
				return array.map(function(topic) {
					return topic[field];
				}).filter(function(value, index, array) {
					return array.indexOf(value) === index;
				});
			}

			if (err) {
				return callback(err);
			}

			var uids = mapFilter(topics, 'uid');
			var cids = mapFilter(topics, 'cid');

			async.parallel({
				users: function(next) {
					user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
				},
				categories: function(next) {
					categories.getMultipleCategoryFields(cids, ['cid', 'name', 'slug', 'icon', 'bgColor', 'color', 'disabled'], next);
				},
				hasRead: function(next) {
					Topics.hasReadTopics(tids, uid, next);
				},
				isAdminOrMod: function(next) {
					privileges.categories.isAdminOrMod(cids, uid, next);
				},
				teasers: function(next) {
					Topics.getTeasers(tids, next);
				},
				tags: function(next) {
					Topics.getTopicsTagsObjects(tids, next);
				}
			}, function(err, results) {
				function arrayToObject(array, field) {
					var obj = {};
					for (var i=0; i<array.length; ++i) {
						obj[array[i][field]] = array[i];
					}
					return obj;
				}

				if (err) {
					return callback(err);
				}

				var users = arrayToObject(results.users, 'uid');
				var categories = arrayToObject(results.categories, 'cid');
				var isAdminOrMod = {};
				cids.forEach(function(cid, index) {
					isAdminOrMod[cid] = results.isAdminOrMod[index];
				});

				for (var i=0; i<topics.length; ++i) {
					topics[i].category = categories[topics[i].cid];
					topics[i].category.disabled = parseInt(topics[i].category.disabled, 10) === 1;
					topics[i].user = users[topics[i].uid];
					topics[i].teaser = results.teasers[i];
					topics[i].tags = results.tags[i];

					topics[i].pinned = parseInt(topics[i].pinned, 10) === 1;
					topics[i].locked = parseInt(topics[i].locked, 10) === 1;
					topics[i].deleted = parseInt(topics[i].deleted, 10) === 1;
					topics[i].unread = !(results.hasRead[i] && parseInt(uid, 10) !== 0);
					topics[i].unreplied = parseInt(topics[i].postcount, 10) <= 1;
				}

				topics = topics.filter(function(topic) {
					return !topic.category.disabled &&
						(!topic.deleted || (topic.deleted && isAdminOrMod[topic.cid]) ||
						parseInt(topic.uid, 10) === parseInt(uid, 10));
				});

				plugins.fireHook('filter:topics.get', topics, callback);
			});
		});
	};

	Topics.getTopicWithPosts = function(tid, set, uid, start, end, reverse, callback) {
		Topics.getTopicData(tid, function(err, topicData) {
			if (err || !topicData) {
				return callback(err || new Error('[[error:no-topic]]'));
			}

			async.parallel({
 				posts: function(next) {
					posts.getPidsFromSet(set, start, end, reverse, function(err, pids) {
						if (err) {
							return next(err);
						}

						pids = topicData.mainPid ? [topicData.mainPid].concat(pids) : pids;
						if (!pids.length) {
							return next(null, []);
						}
						posts.getPostsByPids(pids, tid, function(err, posts) {
							if (err) {
								return next(err);
							}
							start = parseInt(start, 10);
							for(var i=0; i<posts.length; ++i) {
								posts[i].index = start + i;
							}
							posts[0].index = 0;
							Topics.addPostData(posts, uid, next);
						});
					});
 				},
				category: function(next) {
					Topics.getCategoryData(tid, next);
				},
				pageCount: function(next) {
					Topics.getPageCount(tid, uid, next);
				},
				threadTools: function(next) {
					plugins.fireHook('filter:topic.thread_tools', [], next);
				},
				tags: function(next) {
					Topics.getTopicTagsObjects(tid, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				topicData.category = results.category;
				topicData.posts = results.posts;
				topicData.tags = results.tags;
				topicData.thread_tools = results.threadTools;
				topicData.pageCount = results.pageCount;
				topicData.unreplied = parseInt(topicData.postcount, 10) === 1;
				topicData.deleted = parseInt(topicData.deleted, 10) === 1;
				topicData.locked = parseInt(topicData.locked, 10) === 1;
				topicData.pinned = parseInt(topicData.pinned, 10) === 1;

				plugins.fireHook('filter:topic.get', topicData, callback);
			});
		});
	};

	Topics.getMainPost = function(tid, uid, callback) {
		Topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
			if (err) {
				return callback(err);
			}
			if (!parseInt(mainPid, 10)) {
				return callback(null, []);
			}
			posts.getPostsByPids([mainPid], tid, function(err, postData) {
				if (err) {
					return callback(err);
				}
				if (!Array.isArray(postData) || !postData[0]) {
					return callback(null, []);
				}
				postData[0].index = 0;
				Topics.addPostData(postData, uid, callback);
			});
		});
	};

	Topics.getTeasers = function(tids, callback) {
		if(!Array.isArray(tids)) {
			return callback(null, []);
		}

		async.map(tids, function(tid, next) {
			db.getSortedSetRevRange('tid:' + tid + ':posts', 0, 0, function(err, data) {
				next(err, Array.isArray(data) && data.length ? data[0] : null);
			});
		}, function(err, pids) {
			if (err) {
				return callback(err);
			}

			var postKeys = pids.map(function(pid) {
				return 'post:' + pid;
			});

			async.parallel({
				indices: function(next) {
					var sets = tids.map(function(tid) {
						return 'tid:' + tid + ':posts';
					});
					db.sortedSetsRanks(sets, pids, next);
				},
				posts: function(next) {
					db.getObjectsFields(postKeys, ['pid', 'uid', 'timestamp'], next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var indices = results.indices.map(function(index) {
					if (!utils.isNumber(index)) {
						return 1;
					}
					return parseInt(index, 10) + 2;
				});

				var uids = results.posts.map(function(post) {
					return post.uid;
				}).filter(function(uid, index, array) {
					return array.indexOf(uid) === index;
				});

				user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], function(err, userData) {
					if (err) {
						return callback(err);
					}

					var users = {};
					userData.forEach(function(user) {
						users[user.uid] = user;
					});

					results.posts.forEach(function(post, index) {
						post.user = users[post.uid];
						post.index = indices[index];
						post.timestamp = utils.toISOString(post.timestamp);
					});

					callback(err, results.posts);
				});
			});
		});
	};

	Topics.getTeaser = function(tid, callback) {
		Topics.getLatestUndeletedPid(tid, function(err, pid) {
			if (err || !pid) {
				return callback(err);
			}

			async.parallel({
				postData: function(next) {
					posts.getPostFields(pid, ['pid', 'uid', 'timestamp'], function(err, postData) {
						if (err) {
							return next(err);
						} else if(!postData || !utils.isNumber(postData.uid)) {
							return callback();
						}

						user.getUserFields(postData.uid, ['username', 'userslug', 'picture'], function(err, userData) {
							if (err) {
								return next(err);
							}
							postData.user = userData;
							next(null, postData);
						});
					});
				},
				postIndex: function(next) {
					posts.getPidIndex(pid, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.postData.timestamp = utils.toISOString(results.postData.timestamp);
				results.postData.index = results.postIndex;

				callback(null, results.postData);
			});
		});
	};

	Topics.getTopicField = function(tid, field, callback) {
		db.getObjectField('topic:' + tid, field, callback);
	};

	Topics.getTopicFields = function(tid, fields, callback) {
		db.getObjectFields('topic:' + tid, fields, callback);
	};

	Topics.getTopicsFields = function(tids, fields, callback) {
		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});
		db.getObjectsFields(keys, fields, callback);
	};

	Topics.setTopicField = function(tid, field, value, callback) {
		db.setObjectField('topic:' + tid, field, value, callback);
	};

	Topics.isLocked = function(tid, callback) {
		Topics.getTopicField(tid, 'locked', function(err, locked) {
			if(err) {
				return callback(err);
			}
			callback(null, parseInt(locked, 10) === 1);
		});
	};

	Topics.isOwner = function(tid, uid, callback) {
		uid = parseInt(uid, 10);
		if (uid === 0) {
			return callback(null, false);
		}
		Topics.getTopicField(tid, 'uid', function(err, author) {
			callback(err, parseInt(author, 10) === uid);
		});
	};

	Topics.updateTimestamp = function(tid, timestamp) {
		db.sortedSetAdd('topics:recent', timestamp, tid);
		Topics.setTopicField(tid, 'lastposttime', timestamp);
	};

	Topics.getUids = function(tid, callback) {
		Topics.getPids(tid, function(err, pids) {
			if (err) {
				return callback(err);
			}

			var keys = pids.map(function(pid) {
				return 'post:' + pid;
			});

			db.getObjectsFields(keys, ['uid'], function(err, data) {
				if (err) {
					return callback(err);
				}

				var uids = data.map(function(data) {
					return data.uid;
				}).filter(function(uid, pos, array) {
					return array.indexOf(uid) === pos;
				});

				callback(null, uids);
			});
		});
	};

}(exports));
