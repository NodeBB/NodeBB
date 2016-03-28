"use strict";

var async = require('async');
var _ = require('underscore');

var db = require('./database');
var posts = require('./posts');
var utils = require('../public/src/utils');
var plugins = require('./plugins');
var user = require('./user');
var categories = require('./categories');
var privileges = require('./privileges');
var social = require('./social');

(function(Topics) {


	require('./topics/data')(Topics);
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
	require('./topics/suggested')(Topics);
	require('./topics/tools')(Topics);

	Topics.exists = function(tid, callback) {
		db.isSortedSetMember('topics:tid', tid, callback);
	};

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
			if (err) {
				return callback(err);
			}
			callback(null, Math.ceil((results.index + 1) / results.settings.topicsPerPage));
		});
	};

	Topics.getTopicsFromSet = function(set, uid, start, stop, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange(set, start, stop, next);
			},
			function(tids, next) {
				Topics.getTopics(tids, uid, next);
			},
			function(topics, next) {
				next(null, {topics: topics, nextStart: stop + 1});
			}
		], callback);
	};

	Topics.getTopics = function(tids, uid, callback) {
		async.waterfall([
			function(next) {
				privileges.topics.filterTids('read', tids, uid, next);
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

		var uids, cids, topics;

		async.waterfall([
			function(next) {
				Topics.getTopicsData(tids, next);
			},
			function(_topics, next) {
				function mapFilter(array, field) {
					return array.map(function(topic) {
						return topic && topic[field] && topic[field].toString();
					}).filter(function(value, index, array) {
						return utils.isNumber(value) && array.indexOf(value) === index;
					});
				}

				topics = _topics;
				uids = mapFilter(topics, 'uid');
				cids = mapFilter(topics, 'cid');

				async.parallel({
					users: function(next) {
						user.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status'], next);
					},
					categories: function(next) {
						categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'image', 'bgColor', 'color', 'disabled'], next);
					},
					hasRead: function(next) {
						Topics.hasReadTopics(tids, uid, next);
					},
					bookmarks: function(next) {
						Topics.getUserBookmarks(tids, uid, next);
					},
					teasers: function(next) {
						Topics.getTeasers(topics, next);
					},
					tags: function(next) {
						Topics.getTopicsTagsObjects(tids, next);
					}
				}, next);
			},
			function(results, next) {
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
						topics[i].bookmark = results.bookmarks[i];
						topics[i].unreplied = !topics[i].teaser;
					}
				}

				topics = topics.filter(function(topic) {
					return topic &&	topic.category && !topic.category.disabled;
				});

				plugins.fireHook('filter:topics.get', {topics: topics, uid: uid}, next);
			},
			function(data, next) {
				next(null, data.topics);
			}
		], callback);
	};

	Topics.getTopicWithPosts = function(topicData, set, uid, start, stop, reverse, callback) {
		async.waterfall([
			function (next) {
				async.parallel({
					posts: async.apply(getMainPostAndReplies, topicData, set, uid, start, stop, reverse),
					category: async.apply(Topics.getCategoryData, topicData.tid),
					threadTools: async.apply(plugins.fireHook, 'filter:topic.thread_tools', {topic: topicData, uid: uid, tools: []}),
					tags: async.apply(Topics.getTopicTagsObjects, topicData.tid),
					isFollowing: async.apply(Topics.isFollowing, [topicData.tid], uid),
					bookmark: async.apply(Topics.getUserBookmark, topicData.tid, uid),
					postSharing: async.apply(social.getActivePostSharing)
				}, next);
			},
			function (results, next) {
				topicData.posts = results.posts;
				topicData.category = results.category;
				topicData.thread_tools = results.threadTools.tools;
				topicData.tags = results.tags;
				topicData.isFollowing = results.isFollowing[0];
				topicData.bookmark = results.bookmark;
				topicData.postSharing = results.postSharing;

				topicData.unreplied = parseInt(topicData.postcount, 10) === 1;
				topicData.deleted = parseInt(topicData.deleted, 10) === 1;
				topicData.locked = parseInt(topicData.locked, 10) === 1;
				topicData.pinned = parseInt(topicData.pinned, 10) === 1;

				Topics.getRelatedTopics(topicData, uid, next);
			},
			function (related, next) {
				topicData.related = related || [];
				plugins.fireHook('filter:topic.get', {topic: topicData, uid: uid}, next);
			},
			function (data, next) {
				next(null, data.topic);
			}
		], callback);
	};

	function getMainPostAndReplies(topic, set, uid, start, stop, reverse, callback) {
		async.waterfall([
			function(next) {
				posts.getPidsFromSet(set, start, stop, reverse, next);
			},
			function(pids, next) {
				if ((!Array.isArray(pids) || !pids.length) && !topic.mainPid) {
					return callback(null, []);
				}

				if (topic.mainPid && start === 0) {
					pids.unshift(topic.mainPid);
				}
				posts.getPostsByPids(pids, uid, next);
			},
			function(posts, next) {
				if (!posts.length) {
					return next(null, []);
				}
				var replies = posts;
				if (topic.mainPid && start === 0) {
					posts[0].index = 0;
					replies = posts.slice(1);
				}

				Topics.calculatePostIndices(replies, start, stop, topic.postcount, reverse);

				Topics.addPostData(posts, uid, next);
			}
		], callback);
	}

	Topics.getMainPost = function(tid, uid, callback) {
		Topics.getMainPosts([tid], uid, function(err, mainPosts) {
			callback(err, Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null);
		});
	};

	Topics.getMainPids = function(tids, callback) {
		if (!Array.isArray(tids) || !tids.length) {
			return callback(null, []);
		}

		Topics.getTopicsFields(tids, ['mainPid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			var mainPids = topicData.map(function(topic) {
				return topic && topic.mainPid;
			});
			callback(null, mainPids);
		});
	};

	Topics.getMainPosts = function(tids, uid, callback) {
		Topics.getMainPids(tids, function(err, mainPids) {
			if (err) {
				return callback(err);
			}
			getMainPosts(mainPids, uid, callback);
		});
	};

	function getMainPosts(mainPids, uid, callback) {
		posts.getPostsByPids(mainPids, uid, function(err, postData) {
			if (err) {
				return callback(err);
			}
			postData.forEach(function(post) {
				if (post) {
					post.index = 0;
				}
			});
			Topics.addPostData(postData, uid, callback);
		});
	}

	Topics.getUserBookmark = function (tid, uid, callback) {
		db.sortedSetScore('tid:' + tid + ':bookmarks', uid, callback);
	};

	Topics.getUserBookmarks = function(tids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function() {
				return null;
			}));
		}
		db.sortedSetsScore(tids.map(function(tid) {
			return 'tid:' + tid + ':bookmarks';
		}), uid, callback);
	};

	Topics.setUserBookmark = function(tid, uid, index, callback) {
		db.sortedSetAdd('tid:' + tid + ':bookmarks', index, uid, callback);
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
