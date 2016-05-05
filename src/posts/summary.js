
'use strict';

var async = require('async');
var validator = require('validator');
var S = require('string');

var db = require('../database');
var user = require('../user');
var plugins = require('../plugins');
var categories = require('../categories');
var utils = require('../../public/src/utils');


module.exports = function(Posts) {

	Posts.getPostSummaryByPids = function(pids, uid, options, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		options.stripTags = options.hasOwnProperty('stripTags') ? options.stripTags : false;
		options.parse = options.hasOwnProperty('parse') ? options.parse : true;
		options.extraFields = options.hasOwnProperty('extraFields') ? options.extraFields : [];

		var fields = ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted'].concat(options.extraFields);

		Posts.getPostsFields(pids, fields, function(err, posts) {
			if (err) {
				return callback(err);
			}

			posts = posts.filter(Boolean);

			var uids = [], topicKeys = [];
			for(var i=0; i<posts.length; ++i) {
				if (uids.indexOf(posts[i].uid) === -1) {
					uids.push(posts[i].uid);
				}
				if (topicKeys.indexOf('topic:' + posts[i].tid) === -1) {
					topicKeys.push('topic:' + posts[i].tid);
				}
			}

			async.parallel({
				users: function(next) {
					user.getUsersFields(uids, ['uid', 'username', 'userslug', 'picture'], next);
				},
				topicsAndCategories: function(next) {
					getTopicAndCategories(topicKeys, next);
				},
				indices: function(next) {
					Posts.getPostIndices(posts, uid, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				results.users = toObject('uid', results.users);
				results.topics = toObject('tid', results.topicsAndCategories.topics);
				results.categories = toObject('cid', results.topicsAndCategories.categories);

				for (var i=0; i<posts.length; ++i) {
					posts[i].index = utils.isNumber(results.indices[i]) ? parseInt(results.indices[i], 10) + 1 : 1;
					posts[i].isMainPost = posts[i].index - 1 === 0;
					posts[i].deleted = parseInt(posts[i].deleted, 10) === 1;
				}

				posts = posts.filter(function(post) {
					return results.topics[post.tid];
				});

				async.map(posts, function(post, next) {
					// If the post author isn't represented in the retrieved users' data, then it means they were deleted, assume guest.
					if (!results.users.hasOwnProperty(post.uid)) {
						post.uid = 0;
					}

					post.user = results.users[post.uid];
					post.topic = results.topics[post.tid];
					post.category = results.categories[post.topic.cid];
					post.timestampISO = utils.toISOString(post.timestamp);

					if (!post.content || !options.parse) {
						if (options.stripTags) {
							post.content = stripTags(post.content);
						}
						post.content = post.content ? validator.escape(post.content) : post.content;
						return next(null, post);
					}

					Posts.parsePost(post, function(err, post) {
						if (err) {
							return next(err);
						}
						if (options.stripTags) {
							post.content = stripTags(post.content);
						}

						next(null, post);
					});
				}, function(err, posts) {
					plugins.fireHook('filter:post.getPostSummaryByPids', {posts: posts, uid: uid}, function(err, postData) {
						callback(err, postData.posts);
					});
				});
			});
		});
	};

	function getTopicAndCategories(topicKeys, callback) {
		db.getObjectsFields(topicKeys, ['uid', 'tid', 'title', 'cid', 'slug', 'deleted', 'postcount'], function(err, topics) {
			if (err) {
				return callback(err);
			}

			var cids = topics.map(function(topic) {
				if (topic) {
					topic.title = validator.escape(topic.title);
				}
				return topic && topic.cid;
			}).filter(function(topic, index, array) {
				return topic && array.indexOf(topic) === index;
			});

			categories.getCategoriesFields(cids, ['cid', 'name', 'icon', 'slug', 'parentCid', 'bgColor', 'color'], function(err, categories) {
				callback(err, {topics: topics, categories: categories});
			});
		});
	}

	function toObject(key, data) {
		var obj = {};
		for(var i=0; i<data.length; ++i) {
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