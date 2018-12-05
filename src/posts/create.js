'use strict';

var async = require('async');
var _ = require('lodash');

var meta = require('../meta');
var db = require('../database');
var plugins = require('../plugins');
var user = require('../user');
var topics = require('../topics');
var categories = require('../categories');
var groups = require('../groups');
var utils = require('../utils');

module.exports = function (Posts) {
	Posts.create = function (data, callback) {
		// This is an internal method, consider using Topics.reply instead
		var uid = data.uid;
		var tid = data.tid;
		var content = data.content.toString();
		var timestamp = data.timestamp || Date.now();
		var isMain = data.isMain || false;

		if (!uid && parseInt(uid, 10) !== 0) {
			return callback(new Error('[[error:invalid-uid]]'));
		}

		if (data.toPid && !utils.isNumber(data.toPid)) {
			return callback(new Error('[[error:invalid-pid]]'));
		}

		var postData;

		async.waterfall([
			function (next) {
				db.incrObjectField('global', 'nextPid', next);
			},
			function (pid, next) {
				postData = {
					pid: pid,
					uid: uid,
					tid: tid,
					content: content,
					timestamp: timestamp,
					deleted: 0,
				};

				if (data.toPid) {
					postData.toPid = data.toPid;
				}

				if (data.ip && meta.config.trackIpPerPost) {
					postData.ip = data.ip;
				}

				if (data.handle && !parseInt(uid, 10)) {
					postData.handle = data.handle;
				}

				plugins.fireHook('filter:post.create', { post: postData, data: data }, next);
			},
			function (data, next) {
				postData = data.post;
				db.setObject('post:' + postData.pid, postData, next);
			},
			function (next) {
				async.parallel([
					function (next) {
						user.onNewPostMade(postData, next);
					},
					function (next) {
						topics.onNewPostMade(postData, next);
					},
					function (next) {
						topics.getTopicFields(tid, ['cid', 'pinned'], function (err, topicData) {
							if (err) {
								return next(err);
							}
							postData.cid = topicData.cid;
							categories.onNewPostMade(topicData.cid, topicData.pinned, postData, next);
						});
					},
					function (next) {
						groups.onNewPostMade(postData, next);
					},
					function (next) {
						db.sortedSetAdd('posts:pid', timestamp, postData.pid, next);
					},
					function (next) {
						if (!postData.toPid) {
							return next(null);
						}
						async.parallel([
							async.apply(db.sortedSetAdd, 'pid:' + postData.toPid + ':replies', timestamp, postData.pid),
							async.apply(db.incrObjectField, 'post:' + postData.toPid, 'replies'),
						], next);
					},
					function (next) {
						db.incrObjectField('global', 'postCount', next);
					},
					async.apply(Posts.uploads.sync, postData.pid),
				], function (err) {
					next(err);
				});
			},
			function (next) {
				plugins.fireHook('filter:post.get', { post: postData, uid: data.uid }, next);
			},
			function (data, next) {
				data.post.isMain = isMain;
				plugins.fireHook('action:post.save', { post: _.clone(data.post) });
				next(null, data.post);
			},
		], callback);
	};
};
