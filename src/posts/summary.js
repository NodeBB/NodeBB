
'use strict';

var async = require('async');
var validator = require('validator');
var S = require('string');

var db = require('../database');
var user = require('../user');
var plugins = require('../plugins');
var categories = require('../categories');
var utils = require('../../public/src/utils');


module.exports = function (Posts) {
	Posts.getPostSummaryByPids = function (pids, uid, options, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		options.stripTags = options.hasOwnProperty('stripTags') ? options.stripTags : false;
		options.parse = options.hasOwnProperty('parse') ? options.parse : true;
		options.extraFields = options.hasOwnProperty('extraFields') ? options.extraFields : [];

		var fields = ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted', 'upvotes', 'downvotes'].concat(options.extraFields);

		var posts;
		async.waterfall([
			function (next) {
				Posts.getPostsFields(pids, fields, next);
			},
			function (_posts, next) {
				posts = _posts.filter(Boolean);

				var uids = [];
				var topicKeys = [];

				posts.forEach(function (post, i) {
					if (uids.indexOf(posts[i].uid) === -1) {
						uids.push(posts[i].uid);
					}
					if (topicKeys.indexOf('topic:' + posts[i].tid) === -1) {
						topicKeys.push('topic:' + posts[i].tid);
					}
				});
				async.parallel({
					users: function (next) {
						user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
					},
					topicsAndCategories: function (next) {
						getTopicAndCategories(topicKeys, next);
					},
				}, next);
			},
			function (results, next) {
				results.users = toObject('uid', results.users);
				results.topics = toObject('tid', results.topicsAndCategories.topics);
				results.categories = toObject('cid', results.topicsAndCategories.categories);

				posts.forEach(function (post) {
					// If the post author isn't represented in the retrieved users' data, then it means they were deleted, assume guest.
					if (!results.users.hasOwnProperty(post.uid)) {
						post.uid = 0;
					}
					post.user = results.users[post.uid];
					post.topic = results.topics[post.tid];
					post.category = post.topic && results.categories[post.topic.cid];
					post.isMainPost = post.topic && parseInt(post.pid, 10) === parseInt(post.topic.mainPid, 10);
					post.deleted = parseInt(post.deleted, 10) === 1;
					post.upvotes = parseInt(post.upvotes, 10) || 0;
					post.downvotes = parseInt(post.downvotes, 10) || 0;
					post.votes = post.upvotes - post.downvotes;
					post.timestampISO = utils.toISOString(post.timestamp);
				});

				posts = posts.filter(function (post) {
					return results.topics[post.tid];
				});

				parsePosts(posts, options, next);
			},
			function (posts, next) {
				plugins.fireHook('filter:post.getPostSummaryByPids', {posts: posts, uid: uid}, next);
			},
			function (data, next) {
				next(null, data.posts);
			},
		], callback);
	};

	function parsePosts(posts, options, callback) {
		async.map(posts, function (post, next) {
			if (!post.content || !options.parse) {
				if (options.stripTags) {
					post.content = stripTags(post.content);
				}
				post.content = post.content ? validator.escape(String(post.content)) : post.content;
				return next(null, post);
			}

			Posts.parsePost(post, function (err, post) {
				if (err) {
					return next(err);
				}
				if (options.stripTags) {
					post.content = stripTags(post.content);
				}

				next(null, post);
			});
		}, callback);
	}

	function getTopicAndCategories(topicKeys, callback) {
		db.getObjectsFields(topicKeys, ['uid', 'tid', 'title', 'cid', 'slug', 'deleted', 'postcount', 'mainPid'], function (err, topics) {
			if (err) {
				return callback(err);
			}

			var cids = topics.map(function (topic) {
				if (topic) {
					topic.title = validator.escape(String(topic.title));
					topic.deleted = parseInt(topic.deleted, 10) === 1;
				}
				return topic && topic.cid;
			}).filter(function (topic, index, array) {
				return topic && array.indexOf(topic) === index;
			});

			categories.getCategoriesFields(cids, ['cid', 'name', 'icon', 'slug', 'parentCid', 'bgColor', 'color'], function (err, categories) {
				callback(err, {topics: topics, categories: categories});
			});
		});
	}

	function toObject(key, data) {
		var obj = {};
		for (var i = 0; i < data.length; i += 1) {
			obj[data[i][key]] = data[i];
		}
		return obj;
	}

	function stripTags(content) {
		if (content) {
			var s = S(content);
			return s.stripTags.apply(s, utils.stripTags).s;
		}
		return content;
	}
};
