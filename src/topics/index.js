'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var posts = require('../posts');
var utils = require('../utils');
var plugins = require('../plugins');
var meta = require('../meta');
var user = require('../user');
var categories = require('../categories');
var privileges = require('../privileges');
var social = require('../social');

var Topics = module.exports;

require('./data')(Topics);
require('./create')(Topics);
require('./delete')(Topics);
require('./sorted')(Topics);
require('./unread')(Topics);
require('./recent')(Topics);
require('./user')(Topics);
require('./fork')(Topics);
require('./posts')(Topics);
require('./follow')(Topics);
require('./tags')(Topics);
require('./teaser')(Topics);
require('./suggested')(Topics);
require('./tools')(Topics);
require('./thumb')(Topics);
require('./bookmarks')(Topics);
require('./merge')(Topics);

Topics.exists = function (tid, callback) {
	db.exists('topic:' + tid, callback);
};

Topics.getTopicsFromSet = function (set, uid, start, stop, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRevRange(set, start, stop, next);
		},
		function (tids, next) {
			Topics.getTopics(tids, uid, next);
		},
		function (topics, next) {
			Topics.calculateTopicIndices(topics, start);
			next(null, { topics: topics, nextStart: stop + 1 });
		},
	], callback);
};

Topics.getTopics = function (tids, uid, callback) {
	async.waterfall([
		function (next) {
			privileges.topics.filterTids('read', tids, uid, next);
		},
		function (tids, next) {
			Topics.getTopicsByTids(tids, uid, next);
		},
	], callback);
};

Topics.getTopicsByTids = function (tids, uid, callback) {
	if (!Array.isArray(tids) || !tids.length) {
		return callback(null, []);
	}

	var uids;
	var cids;
	var topics;

	async.waterfall([
		function (next) {
			Topics.getTopicsData(tids, next);
		},
		function (_topics, next) {
			function mapFilter(array, field) {
				return array.map(function (topic) {
					return topic && topic[field] && topic[field].toString();
				}).filter(value => utils.isNumber(value));
			}

			topics = _topics;
			uids = _.uniq(mapFilter(topics, 'uid'));
			cids = _.uniq(mapFilter(topics, 'cid'));

			async.parallel({
				users: function (next) {
					user.getUsersFields(uids, ['uid', 'username', 'fullname', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned', 'status'], next);
				},
				userSettings: function (next) {
					user.getMultipleUserSettings(uids, next);
				},
				categories: function (next) {
					categories.getCategoriesFields(cids, ['cid', 'name', 'slug', 'icon', 'image', 'imageClass', 'bgColor', 'color', 'disabled'], next);
				},
				hasRead: function (next) {
					Topics.hasReadTopics(tids, uid, next);
				},
				isIgnored: function (next) {
					Topics.isIgnoring(tids, uid, next);
				},
				bookmarks: function (next) {
					Topics.getUserBookmarks(tids, uid, next);
				},
				teasers: function (next) {
					Topics.getTeasers(topics, uid, next);
				},
				tags: function (next) {
					Topics.getTopicsTagsObjects(tids, next);
				},
			}, next);
		},
		function (results, next) {
			results.users.forEach(function (user, index) {
				if (meta.config.hideFullname || !results.userSettings[index].showfullname) {
					user.fullname = undefined;
				}
			});

			var users = _.zipObject(uids, results.users);
			var categories = _.zipObject(cids, results.categories);

			for (var i = 0; i < topics.length; i += 1) {
				if (topics[i]) {
					topics[i].category = categories[topics[i].cid];
					topics[i].user = users[topics[i].uid];
					topics[i].teaser = results.teasers[i];
					topics[i].tags = results.tags[i];

					topics[i].isOwner = topics[i].uid === parseInt(uid, 10);
					topics[i].ignored = results.isIgnored[i];
					topics[i].unread = !results.hasRead[i] && !results.isIgnored[i];
					topics[i].bookmark = results.bookmarks[i];
					topics[i].unreplied = !topics[i].teaser;

					topics[i].icons = [];
				}
			}

			topics = topics.filter(topic => topic && topic.category && !topic.category.disabled);

			plugins.fireHook('filter:topics.get', { topics: topics, uid: uid }, next);
		},
		function (data, next) {
			next(null, data.topics);
		},
	], callback);
};

Topics.getTopicWithPosts = function (topicData, set, uid, start, stop, reverse, callback) {
	async.waterfall([
		function (next) {
			async.parallel({
				posts: async.apply(getMainPostAndReplies, topicData, set, uid, start, stop, reverse),
				category: async.apply(categories.getCategoryData, topicData.cid),
				tagWhitelist: async.apply(categories.getTagWhitelist, [topicData.cid]),
				threadTools: async.apply(plugins.fireHook, 'filter:topic.thread_tools', { topic: topicData, uid: uid, tools: [] }),
				followData: async.apply(Topics.getFollowData, [topicData.tid], uid),
				bookmark: async.apply(Topics.getUserBookmark, topicData.tid, uid),
				postSharing: async.apply(social.getActivePostSharing),
				deleter: async.apply(getDeleter, topicData),
				merger: async.apply(getMerger, topicData),
				related: function (next) {
					async.waterfall([
						function (next) {
							Topics.getTopicTagsObjects(topicData.tid, next);
						},
						function (tags, next) {
							topicData.tags = tags;
							Topics.getRelatedTopics(topicData, uid, next);
						},
					], next);
				},
			}, next);
		},
		function (results, next) {
			topicData.posts = results.posts;
			topicData.category = results.category;
			topicData.tagWhitelist = results.tagWhitelist[0];
			topicData.thread_tools = results.threadTools.tools;
			topicData.isFollowing = results.followData[0].following;
			topicData.isNotFollowing = !results.followData[0].following && !results.followData[0].ignoring;
			topicData.isIgnoring = results.followData[0].ignoring;
			topicData.bookmark = results.bookmark;
			topicData.postSharing = results.postSharing;
			topicData.deleter = results.deleter;
			if (results.deleter) {
				topicData.deletedTimestampISO = utils.toISOString(topicData.deletedTimestamp);
			}
			topicData.merger = results.merger;
			if (results.merger) {
				topicData.mergedTimestampISO = utils.toISOString(topicData.mergedTimestamp);
			}
			topicData.related = results.related || [];
			topicData.unreplied = topicData.postcount === 1;
			topicData.icons = [];

			plugins.fireHook('filter:topic.get', { topic: topicData, uid: uid }, next);
		},
		function (data, next) {
			next(null, data.topic);
		},
	], callback);
};

function getMainPostAndReplies(topic, set, uid, start, stop, reverse, callback) {
	async.waterfall([
		function (next) {
			if (stop > 0) {
				stop -= 1;
				if (start > 0) {
					start -= 1;
				}
			}

			posts.getPidsFromSet(set, start, stop, reverse, next);
		},
		function (pids, next) {
			if (!pids.length && !topic.mainPid) {
				return callback(null, []);
			}

			if (parseInt(topic.mainPid, 10) && start === 0) {
				pids.unshift(topic.mainPid);
			}
			posts.getPostsByPids(pids, uid, next);
		},
		function (posts, next) {
			if (!posts.length) {
				return next(null, []);
			}
			var replies = posts;
			if (topic.mainPid && start === 0) {
				posts[0].index = 0;
				replies = posts.slice(1);
			}

			Topics.calculatePostIndices(replies, start, topic.postcount, reverse);

			Topics.addPostData(posts, uid, next);
		},
	], callback);
}

function getDeleter(topicData, callback) {
	if (!parseInt(topicData.deleterUid, 10)) {
		return setImmediate(callback, null, null);
	}
	user.getUserFields(topicData.deleterUid, ['username', 'userslug', 'picture'], callback);
}

function getMerger(topicData, callback) {
	if (!parseInt(topicData.mergerUid, 10)) {
		return setImmediate(callback, null, null);
	}
	async.waterfall([
		function (next) {
			async.parallel({
				merger: function (next) {
					user.getUserFields(topicData.mergerUid, ['username', 'userslug', 'picture'], next);
				},
				mergedIntoTitle: function (next) {
					Topics.getTopicField(topicData.mergeIntoTid, 'title', next);
				},
			}, next);
		},
		function (results, next) {
			results.merger.mergedIntoTitle = results.mergedIntoTitle;
			next(null, results.merger);
		},
	], callback);
}

Topics.getMainPost = function (tid, uid, callback) {
	Topics.getMainPosts([tid], uid, function (err, mainPosts) {
		callback(err, Array.isArray(mainPosts) && mainPosts.length ? mainPosts[0] : null);
	});
};

Topics.getMainPids = function (tids, callback) {
	if (!Array.isArray(tids) || !tids.length) {
		return callback(null, []);
	}
	async.waterfall([
		function (next) {
			Topics.getTopicsFields(tids, ['mainPid'], next);
		},
		function (topicData, next) {
			next(null, topicData.map(topic => topic && topic.mainPid));
		},
	], callback);
};

Topics.getMainPosts = function (tids, uid, callback) {
	async.waterfall([
		function (next) {
			Topics.getMainPids(tids, next);
		},
		function (mainPids, next) {
			getMainPosts(mainPids, uid, next);
		},
	], callback);
};

function getMainPosts(mainPids, uid, callback) {
	async.waterfall([
		function (next) {
			posts.getPostsByPids(mainPids, uid, next);
		},
		function (postData, next) {
			postData.forEach(function (post) {
				if (post) {
					post.index = 0;
				}
			});
			Topics.addPostData(postData, uid, next);
		},
	], callback);
}

Topics.isLocked = function (tid, callback) {
	Topics.getTopicField(tid, 'locked', function (err, locked) {
		callback(err, locked === 1);
	});
};

Topics.search = function (tid, term, callback) {
	plugins.fireHook('filter:topic.search', {
		tid: tid,
		term: term,
	}, function (err, pids) {
		callback(err, Array.isArray(pids) ? pids : []);
	});
};

Topics.async = require('../promisify')(Topics);
