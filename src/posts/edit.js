'use strict';

var async = require('async'),
	validator = require('validator'),
	_ = require('underscore'),
	db = require('../database'),
	topics = require('../topics'),
	user = require('../user'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	cache = require('./cache'),
	pubsub = require('../pubsub'),
	utils = require('../../public/src/utils');

module.exports = function(Posts) {

	pubsub.on('post:edit', function(pid) {
		cache.del(pid);
	});

	Posts.edit = function(data, callback) {
		var now = Date.now();
		var postData;
		var results;

		async.waterfall([
			function (next) {
				privileges.posts.canEdit(data.pid, data.uid, next);
			},
			function (canEdit, next) {
				if (!canEdit) {
					return next(new Error('[[error:no-privileges]]'));
				}
				Posts.getPostData(data.pid, next);
			},
			function (_postData, next) {
				if (!_postData) {
					return next(new Error('[[error:no-post]]'));
				}
				postData = _postData;
				postData.content = data.content;
				postData.edited = now;
				postData.editor = data.uid;
				plugins.fireHook('filter:post.edit', {req: data.req, post: postData, uid: data.uid}, next);
			},
			function (result, next) {
				postData = result.post;
				var updateData = {
					edited: postData.edited,
					editor: postData.editor,
					content: postData.content
				};
				if (data.handle) {
					updateData.handle = data.handle;
				}
				Posts.setPostFields(data.pid, updateData, next);
			},
			function (next) {
				async.parallel({
					editor: function(next) {
						user.getUserFields(data.uid, ['username', 'userslug'], next);
					},
					topic: function(next) {
						editMainPost(data, postData, next);
					}
				}, next);
			},
			function (_results, next) {
				results = _results;

				postData.cid = results.topic.cid;

				plugins.fireHook('action:post.edit', _.clone(postData));

				cache.del(postData.pid);
				pubsub.publish('post:edit', postData.pid);

				Posts.parsePost(postData, next);
			},
			function (postData, next) {
				results.post = postData;
				next(null, results);
			}
		], callback);
	};

	function editMainPost(data, postData, callback) {
		var tid = postData.tid;
		var title = data.title ? data.title.trim() : '';

		async.parallel({
			topic: function(next) {
				topics.getTopicFields(tid, ['cid', 'title'], next);
			},
			isMain: function(next) {
				Posts.isMain(data.pid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!results.isMain) {
				return callback(null, {
					tid: tid,
					cid: results.topic.cid,
					isMainPost: false,
					renamed: false
				});
			}

			var topicData = {
				tid: tid,
				cid: results.topic.cid,
				uid: postData.uid,
				mainPid: data.pid
			};

			if (title) {
				topicData.title = title;
				topicData.slug = tid + '/' + (utils.slugify(title) || 'topic');
			}

			topicData.thumb = data.topic_thumb || '';

			data.tags = data.tags || [];

			async.waterfall([
				async.apply(plugins.fireHook, 'filter:topic.edit', {req: data.req, topic: topicData}),
				function(results, next) {
					db.setObject('topic:' + tid, results.topic, next);
				},
				function(next) {
					topics.updateTags(tid, data.tags, next);
				},
				function(next) {
					topics.getTopicTagsObjects(tid, next);
				},
				function(tags, next) {
					topicData.tags = data.tags;
					plugins.fireHook('action:topic.edit', topicData);
					next(null, {
						tid: tid,
						cid: results.topic.cid,
						uid: postData.uid,
						title: validator.escape(title),
						oldTitle: results.topic.title,
						slug: topicData.slug,
						isMainPost: true,
						renamed: title !== results.topic.title,
						tags: tags
					});
				}
			], callback);
		});
	}


};
