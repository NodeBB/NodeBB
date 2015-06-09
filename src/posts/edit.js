'use strict';

var async = require('async'),
	validator = require('validator'),
	db = require('../database'),
	topics = require('../topics'),
	user = require('../user'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	cache = require('./cache'),
	utils = require('../../public/src/utils');

module.exports = function(Posts) {

	Posts.edit = function(data, callback) {
		var now = Date.now();
		var postData;

		async.waterfall([
			function (next) {
				privileges.posts.canEdit(data.pid, data.uid, next);
			},
			function(canEdit, next) {
				if (!canEdit) {
					return next(new Error('[[error:no-privileges]]'));
				}
				Posts.getPostData(data.pid, next);
			},
			function(_postData, next) {
				postData = _postData;
				postData.content = data.content;
				postData.edited = now;
				postData.editor = data.uid;
				plugins.fireHook('filter:post.edit', {post: postData, uid: data.uid}, next);
			},
			function(result, next) {
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
			}
		], function(err, result) {
			if (err) {
				return callback(err);
			}

			async.parallel({
				editor: function(next) {
					user.getUserFields(data.uid, ['username', 'userslug'], next);
				},
				topic: function(next) {
					editMainPost(data, postData, next);
				},
				post: function(next) {
					cache.del(postData.pid);
					Posts.parsePost(postData, next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				postData.cid = results.topic.cid;
				plugins.fireHook('action:post.edit', postData);

				callback(null, results);
			});
		});
	};

	function editMainPost(data, postData, callback) {
		var tid = postData.tid;
		var title = data.title.trim();

		async.parallel({
			cid: function(next) {
				topics.getTopicField(tid, 'cid', next);
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
					cid: results.cid,
					isMainPost: false
				});
			}

			var topicData = {
				tid: tid,
				cid: results.cid,
				uid: postData.uid,
				mainPid: data.pid
			};

			if (title) {
				topicData.title = title;
				topicData.slug = tid + '/' + utils.slugify(title);
			}

			if (data.topic_thumb) {
				topicData.thumb = data.topic_thumb;
			}

			data.tags = data.tags || [];

			async.waterfall([
				async.apply(plugins.fireHook,'filter:topic.edit', topicData),
				function(topicData, next) {
					db.setObject('topic:' + tid, topicData, next);
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
						cid: results.cid,
						uid: postData.uid,
						title: validator.escape(title),
						slug: topicData.slug,
						isMainPost: results.isMain,
						tags: tags
					});
				}
			], callback);
		});
	}


};
