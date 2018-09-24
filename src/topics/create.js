
'use strict';

var async = require('async');
var _ = require('lodash');
var validator = require('validator');

var db = require('../database');
var utils = require('../utils');
var plugins = require('../plugins');
var analytics = require('../analytics');
var user = require('../user');
var meta = require('../meta');
var posts = require('../posts');
var privileges = require('../privileges');
var categories = require('../categories');

module.exports = function (Topics) {
	Topics.create = function (data, callback) {
		// This is an internal method, consider using Topics.post instead
		var timestamp = data.timestamp || Date.now();
		var topicData;

		async.waterfall([
			function (next) {
				Topics.resizeAndUploadThumb(data, next);
			},
			function (next) {
				db.incrObjectField('global', 'nextTid', next);
			},
			function (tid, next) {
				topicData = {
					tid: tid,
					uid: data.uid,
					cid: data.cid,
					mainPid: 0,
					title: data.title,
					slug: tid + '/' + (utils.slugify(data.title) || 'topic'),
					timestamp: timestamp,
					lastposttime: 0,
					postcount: 0,
					viewcount: 0,
					locked: 0,
					deleted: 0,
					pinned: 0,
				};

				if (data.thumb) {
					topicData.thumb = data.thumb;
				}

				plugins.fireHook('filter:topic.create', { topic: topicData, data: data }, next);
			},
			function (data, next) {
				topicData = data.topic;
				db.setObject('topic:' + topicData.tid, topicData, next);
			},
			function (next) {
				async.parallel([
					function (next) {
						db.sortedSetsAdd([
							'topics:tid',
							'cid:' + topicData.cid + ':tids',
							'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids',
						], timestamp, topicData.tid, next);
					},
					function (next) {
						db.sortedSetAdd('cid:' + topicData.cid + ':tids:votes', 0, topicData.tid, next);
					},
					function (next) {
						categories.updateRecentTid(topicData.cid, topicData.tid, next);
					},
					function (next) {
						user.addTopicIdToUser(topicData.uid, topicData.tid, timestamp, next);
					},
					function (next) {
						db.incrObjectField('category:' + topicData.cid, 'topic_count', next);
					},
					function (next) {
						db.incrObjectField('global', 'topicCount', next);
					},
					function (next) {
						Topics.createTags(data.tags, topicData.tid, timestamp, next);
					},
				], next);
			},
			function (results, next) {
				plugins.fireHook('action:topic.save', { topic: _.clone(topicData) });
				next(null, topicData.tid);
			},
		], callback);
	};

	Topics.post = function (data, callback) {
		var uid = data.uid;
		data.title = String(data.title).trim();
		data.tags = data.tags || [];

		async.waterfall([
			function (next) {
				check(data.title, meta.config.minimumTitleLength, meta.config.maximumTitleLength, 'title-too-short', 'title-too-long', next);
			},
			function (next) {
				check(data.tags, meta.config.minimumTagsPerTopic, meta.config.maximumTagsPerTopic, 'not-enough-tags', 'too-many-tags', next);
			},
			function (next) {
				if (data.content) {
					data.content = utils.rtrim(data.content);
				}

				check(data.content, meta.config.minimumPostLength, meta.config.maximumPostLength, 'content-too-short', 'content-too-long', next);
			},
			function (next) {
				async.parallel({
					categoryExists: function (next) {
						categories.exists(data.cid, next);
					},
					canCreate: function (next) {
						privileges.categories.can('topics:create', data.cid, data.uid, next);
					},
					canTag: function (next) {
						if (!data.tags.length) {
							return next(null, true);
						}
						privileges.categories.can('topics:tag', data.cid, data.uid, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.categoryExists) {
					return next(new Error('[[error:no-category]]'));
				}

				if (!results.canCreate || !results.canTag) {
					return next(new Error('[[error:no-privileges]]'));
				}

				guestHandleValid(data, next);
			},
			function (next) {
				user.isReadyToPost(data.uid, data.cid, next);
			},
			function (next) {
				plugins.fireHook('filter:topic.post', data, next);
			},
			function (filteredData, next) {
				data = filteredData;
				Topics.create(data, next);
			},
			function (tid, next) {
				var postData = data;
				postData.tid = tid;
				postData.ip = data.req ? data.req.ip : null;
				postData.isMain = true;
				posts.create(postData, next);
			},
			function (postData, next) {
				onNewPost(postData, data, next);
			},
			function (postData, next) {
				async.parallel({
					postData: function (next) {
						next(null, postData);
					},
					settings: function (next) {
						user.getSettings(uid, function (err, settings) {
							if (err) {
								return next(err);
							}
							if (settings.followTopicsOnCreate) {
								Topics.follow(postData.tid, uid, next);
							} else {
								next();
							}
						});
					},
					topicData: function (next) {
						Topics.getTopicsByTids([postData.tid], uid, next);
					},
				}, next);
			},
			function (result, next) {
				if (!Array.isArray(result.topicData) || !result.topicData.length) {
					return next(new Error('[[error:no-topic]]'));
				}

				result.topicData = result.topicData[0];
				result.topicData.unreplied = 1;
				result.topicData.mainPost = result.postData;
				result.postData.index = 0;

				analytics.increment(['topics', 'topics:byCid:' + result.topicData.cid]);
				plugins.fireHook('action:topic.post', { topic: result.topicData, post: result.postData, data: data });

				if (parseInt(uid, 10)) {
					user.notifications.sendTopicNotificationToFollowers(uid, result.topicData, result.postData);
				}

				next(null, {
					topicData: result.topicData,
					postData: result.postData,
				});
			},
		], callback);
	};

	Topics.reply = function (data, callback) {
		var tid = data.tid;
		var uid = data.uid;
		var postData;

		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				data.cid = cid;
				async.parallel({
					topicData: async.apply(Topics.getTopicData, tid),
					canReply: async.apply(privileges.topics.can, 'topics:reply', tid, uid),
					isAdminOrMod: async.apply(privileges.categories.isAdminOrMod, data.cid, uid),
				}, next);
			},
			function (results, next) {
				if (!results.topicData) {
					return next(new Error('[[error:no-topic]]'));
				}

				if (parseInt(results.topicData.locked, 10) === 1 && !results.isAdminOrMod) {
					return next(new Error('[[error:topic-locked]]'));
				}

				if (parseInt(results.topicData.deleted, 10) === 1 && !results.isAdminOrMod) {
					return next(new Error('[[error:topic-deleted]]'));
				}

				if (!results.canReply) {
					return next(new Error('[[error:no-privileges]]'));
				}

				guestHandleValid(data, next);
			},
			function (next) {
				user.isReadyToPost(uid, data.cid, next);
			},
			function (next) {
				plugins.fireHook('filter:topic.reply', data, next);
			},
			function (filteredData, next) {
				if (data.content) {
					data.content = utils.rtrim(data.content);
				}

				check(data.content, meta.config.minimumPostLength, meta.config.maximumPostLength, 'content-too-short', 'content-too-long', next);
			},
			function (next) {
				data.ip = data.req ? data.req.ip : null;
				posts.create(data, next);
			},
			function (_postData, next) {
				postData = _postData;
				onNewPost(postData, data, next);
			},
			function (postData, next) {
				user.getSettings(uid, next);
			},
			function (settings, next) {
				if (settings.followTopicsOnReply) {
					Topics.follow(postData.tid, uid);
				}

				if (parseInt(uid, 10)) {
					user.setUserField(uid, 'lastonline', Date.now());
				}

				Topics.notifyFollowers(postData, uid);
				analytics.increment(['posts', 'posts:byCid:' + data.cid]);
				plugins.fireHook('action:topic.reply', { post: _.clone(postData), data: data });

				next(null, postData);
			},
		], callback);
	};

	function onNewPost(postData, data, callback) {
		var tid = postData.tid;
		var uid = postData.uid;
		async.waterfall([
			function (next) {
				Topics.markAsUnreadForAll(tid, next);
			},
			function (next) {
				Topics.markAsRead([tid], uid, next);
			},
			function (markedRead, next) {
				async.parallel({
					userInfo: function (next) {
						posts.getUserInfoForPosts([postData.uid], uid, next);
					},
					topicInfo: function (next) {
						Topics.getTopicFields(tid, ['tid', 'uid', 'title', 'slug', 'cid', 'postcount', 'mainPid'], next);
					},
					parents: function (next) {
						Topics.addParentPosts([postData], next);
					},
					content: function (next) {
						posts.parsePost(postData, next);
					},
				}, next);
			},
			function (results, next) {
				postData.user = results.userInfo[0];
				postData.topic = results.topicInfo;
				postData.index = parseInt(results.topicInfo.postcount, 10) - 1;

				// Username override for guests, if enabled
				if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(postData.uid, 10) === 0 && data.handle) {
					postData.user.username = validator.escape(String(data.handle));
				}

				postData.votes = 0;
				postData.bookmarked = false;
				postData.display_edit_tools = true;
				postData.display_delete_tools = true;
				postData.display_moderator_tools = true;
				postData.display_move_tools = true;
				postData.selfPost = false;
				postData.timestampISO = utils.toISOString(postData.timestamp);
				postData.topic.title = String(postData.topic.title);

				next(null, postData);
			},
		], callback);
	}

	function check(item, min, max, minError, maxError, callback) {
		// Trim and remove HTML (latter for composers that send in HTML, like redactor)
		if (typeof item === 'string') {
			item = utils.stripHTMLTags(item).trim();
		}

		if (item === null || item === undefined || item.length < parseInt(min, 10)) {
			return callback(new Error('[[error:' + minError + ', ' + min + ']]'));
		} else if (item.length > parseInt(max, 10)) {
			return callback(new Error('[[error:' + maxError + ', ' + max + ']]'));
		}
		callback();
	}

	function guestHandleValid(data, callback) {
		if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(data.uid, 10) === 0 && data.handle) {
			if (data.handle.length > meta.config.maximumUsernameLength) {
				return callback(new Error('[[error:guest-handle-invalid]]'));
			}
			user.existsBySlug(utils.slugify(data.handle), function (err, exists) {
				if (err || exists) {
					return callback(err || new Error('[[error:username-taken]]'));
				}
				callback();
			});
			return;
		}
		callback();
	}
};
