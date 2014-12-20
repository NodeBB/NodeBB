"use strict";

var async = require('async'),
	validator = require('validator'),

	_ = require('underscore'),
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
	require('./topics/user')(Topics);
	require('./topics/fork')(Topics);
	require('./topics/posts')(Topics);
	require('./topics/follow')(Topics);
	require('./topics/tags')(Topics);
	require('./topics/teaser')(Topics);

	Topics.getTopicData = function(tid, callback) {
		db.getObject('topic:' + tid, function(err, topic) {
			if (err || !topic) {
				return callback(err);
			}
			modifyTopic(topic, callback);
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
			async.map(topics, modifyTopic, callback);
		});
	};

	function modifyTopic(topic, callback) {
		if (!topic) {
			return callback(null, topic);
		}
		topic.title = validator.escape(topic.title);
		topic.relativeTime = utils.toISOString(topic.timestamp);
		callback(null, topic);
	}

	Topics.getPageCount = function(tid, uid, callback) {
		Topics.getTopicField(tid, 'postcount', function(err, postCount) {
			if (err) {
				return callback(err);
			}
			if (!parseInt(postCount, 10)) {
				return callback(null, 1);
			}
			user.getSettings(uid, function(err, settings) {
				if (err) {
					return callback(err);
				}

				callback(null, Math.ceil((parseInt(postCount, 10) - 1) / settings.postsPerPage));
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
			if (err) {
				callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
	};

	Topics.getTopicsFromSet = function(set, uid, start, end, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange(set, start, end, next);
			},
			function(tids, next) {
				Topics.getTopics(tids, uid, next);
			},
			function(topics, next) {
				next(null, {topics: topics, nextStart: end + 1});
			}
		], callback);
	};

	Topics.getTopics = function(tids, uid, callback) {
		async.waterfall([
			function(next) {
				privileges.topics.filter('read', tids, uid, next);
			},
			function(tids, next) {
				Topics.getTopicsByTids(tids, uid, next);
			}
		], callback);
	};

	Topics.getTopicsByTids = function(tids, uid, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		Topics.getTopicsData(tids, function(err, topics) {
			function mapFilter(array, field) {
				return array.map(function(topic) {
					return topic && topic[field] && topic[field].toString();
				}).filter(function(value, index, array) {
					return utils.isNumber(value) && array.indexOf(value) === index;
				});
			}

			if (err) {
				return callback(err);
			}

			var uids = mapFilter(topics, 'uid');
			var cids = mapFilter(topics, 'cid');

			async.parallel({
				teasers: function(next) {
					Topics.getTeasers(topics, next);
				},
				users: function(next) {
					user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
				},
				categories: function(next) {
					categories.getMultipleCategoryFields(cids, ['cid', 'name', 'slug', 'icon', 'bgColor', 'color', 'disabled'], next);
				},
				hasRead: function(next) {
					Topics.hasReadTopics(tids, uid, next);
				},
				tags: function(next) {
					Topics.getTopicsTagsObjects(tids, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var users = _.object(uids, results.users);
				var categories = _.object(cids, results.categories);

				for (var i=0; i<topics.length; ++i) {
					if (topics[i]) {
						topics[i].category = categories[topics[i].cid];
						topics[i].user = users[topics[i].uid];
						topics[i].teaser = results.teasers[i];
						topics[i].tags = results.tags[i];

						topics[i].isOwner = parseInt(topics[i].uid, 10) === parseInt(uid, 10);
						topics[i].pinned = parseInt(topics[i].pinned, 10) === 1;
						topics[i].locked = parseInt(topics[i].locked, 10) === 1;
						topics[i].deleted = parseInt(topics[i].deleted, 10) === 1;
						topics[i].unread = !results.hasRead[i];
						topics[i].unreplied = parseInt(topics[i].postcount, 10) <= 1;
					}
				}

				topics = topics.filter(function(topic) {
					return topic &&	topic.category && !topic.category.disabled;
				});

				plugins.fireHook('filter:topics.get', {topics: topics, uid: uid}, function(err, topicData) {
					callback(err, topicData.topics);
				});
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
						posts.getPostsByPids(pids, uid, function(err, posts) {
							if (err) {
								return next(err);
							}

							Topics.addPostData(posts, uid, next);
						});
					});
				},
				category: async.apply(Topics.getCategoryData, tid),
				threadTools: async.apply(plugins.fireHook, 'filter:topic.thread_tools', []),
				tags: async.apply(Topics.getTopicTagsObjects, tid),
				isFollowing: async.apply(Topics.isFollowing, tid, uid)
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				topicData.posts = results.posts;
				topicData.category = results.category;
				topicData.thread_tools = results.threadTools;
				topicData.tags = results.tags;
				topicData.isFollowing = results.isFollowing;

				topicData.unreplied = parseInt(topicData.postcount, 10) === 1;
				topicData.deleted = parseInt(topicData.deleted, 10) === 1;
				topicData.locked = parseInt(topicData.locked, 10) === 1;
				topicData.pinned = parseInt(topicData.pinned, 10) === 1;

				plugins.fireHook('filter:topic.get', topicData, callback);
			});
		});
	};

	Topics.getMainPost = function(tid, uid, callback) {
		Topics.getMainPosts([tid], uid, function(err, mainPosts) {
			callback(err, Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null);
		});
	};

	Topics.getMainPosts = function(tids, uid, callback) {
		Topics.getTopicsFields(tids, ['mainPid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			var mainPids = topicData.map(function(topic) {
				return topic ? topic.mainPid : null;
			});

			posts.getPostsByPids(mainPids, uid, function(err, postData) {
				if (err) {
					return callback(err);
				}

				Topics.addPostData(postData, uid, callback);
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
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}
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
			callback(err, parseInt(locked, 10) === 1);
		});
	};

	Topics.search = function(tid, term, callback) {
		if (plugins.hasListeners('filter:topic.search')) {
			plugins.fireHook('filter:topic.search', {
				tid: tid,
				term: term
			}, callback);
		} else {
			callback(new Error('no-plugins-available'), []);
		}
	};

}(exports));
