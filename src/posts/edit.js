'use strict';

var async = require('async');
var validator = require('validator');
var _ = require('lodash');

var db = require('../database');
var topics = require('../topics');
var user = require('../user');
var privileges = require('../privileges');
var plugins = require('../plugins');
var cache = require('./cache');
var pubsub = require('../pubsub');
var utils = require('../utils');

module.exports = function (Posts) {
	pubsub.on('post:edit', function (pid) {
		cache.del(pid);
	});

	Posts.edit = function (data, callback) {
		var postData;
		var results;

		async.waterfall([
			function (next) {
				privileges.posts.canEdit(data.pid, data.uid, next);
			},
			function (canEdit, next) {
				if (!canEdit.flag) {
					return next(new Error(canEdit.message));
				}
				Posts.getPostData(data.pid, next);
			},
			function (_postData, next) {
				if (!_postData) {
					return next(new Error('[[error:no-post]]'));
				}

				postData = _postData;
				postData.content = data.content;
				postData.edited = Date.now();
				postData.editor = data.uid;
				if (data.handle) {
					postData.handle = data.handle;
				}
				plugins.fireHook('filter:post.edit', { req: data.req, post: postData, data: data, uid: data.uid }, next);
			},
			function (result, next) {
				postData = result.post;

				async.parallel({
					editor: function (next) {
						user.getUserFields(data.uid, ['username', 'userslug'], next);
					},
					topic: function (next) {
						editMainPost(data, postData, next);
					},
				}, next);
			},
			function (_results, next) {
				results = _results;
				Posts.setPostFields(data.pid, postData, next);
			},
			function (next) {
				postData.cid = results.topic.cid;
				postData.topic = results.topic;
				plugins.fireHook('action:post.edit', { post: _.clone(postData), uid: data.uid });

				cache.del(String(postData.pid));
				pubsub.publish('post:edit', String(postData.pid));

				Posts.parsePost(postData, next);
			},
			function (postData, next) {
				results.post = postData;
				next(null, results);
			},
		], callback);
	};

	function editMainPost(data, postData, callback) {
		var tid = postData.tid;
		var title = data.title ? data.title.trim() : '';

		var topicData;
		var results;
		async.waterfall([
			function (next) {
				async.parallel({
					topic: function (next) {
						topics.getTopicFields(tid, ['cid', 'title', 'timestamp'], next);
					},
					isMain: function (next) {
						Posts.isMain(data.pid, next);
					},
				}, next);
			},
			function (_results, next) {
				results = _results;
				if (!results.isMain) {
					return callback(null, {
						tid: tid,
						cid: results.topic.cid,
						isMainPost: false,
						renamed: false,
					});
				}

				topicData = {
					tid: tid,
					cid: results.topic.cid,
					uid: postData.uid,
					mainPid: data.pid,
				};

				if (title) {
					topicData.title = title;
					topicData.slug = tid + '/' + (utils.slugify(title) || 'topic');
				}

				topicData.thumb = data.thumb || '';

				data.tags = data.tags || [];

				if (!data.tags.length) {
					return next(null, true);
				}

				privileges.categories.can('topics:tag', topicData.cid, data.uid, next);
			},
			function (canTag, next) {
				if (!canTag) {
					return next(new Error('[[error:no-privileges]]'));
				}

				plugins.fireHook('filter:topic.edit', { req: data.req, topic: topicData, data: data }, next);
			},
			function (results, next) {
				db.setObject('topic:' + tid, results.topic, next);
			},
			function (next) {
				topics.updateTags(tid, data.tags, next);
			},
			function (next) {
				topics.getTopicTagsObjects(tid, next);
			},
			function (tags, next) {
				topicData.tags = data.tags;
				topicData.oldTitle = results.topic.title;
				topicData.timestamp = results.topic.timestamp;
				plugins.fireHook('action:topic.edit', { topic: topicData, uid: data.uid });
				next(null, {
					tid: tid,
					cid: topicData.cid,
					uid: postData.uid,
					title: validator.escape(String(title)),
					oldTitle: results.topic.title,
					slug: topicData.slug,
					isMainPost: true,
					renamed: title !== results.topic.title,
					tags: tags,
				});
			},
		], callback);
	}
};
