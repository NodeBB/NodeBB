
'use strict';

var async = require('async'),
	validator = require('validator'),
	db = require('../database'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins'),
	user = require('../user'),
	meta = require('../meta'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	categories = require('../categories');

module.exports = function(Topics) {

	Topics.create = function(data, callback) {
		// This is an interal method, consider using Topics.post instead
		var timestamp = data.timestamp || Date.now();
		var topicData;

		async.waterfall([
			function(next) {
				db.incrObjectField('global', 'nextTid', next);
			},
			function(tid, next) {
				var slug = utils.slugify(data.title);

				if (!slug.length) {
					return callback(new Error('[[error:invalid-title]]'));
				}

				slug = tid + '/' + slug;

				topicData = {
					'tid': tid,
					'uid': data.uid,
					'cid': data.cid,
					'mainPid': 0,
					'title': data.title,
					'slug': slug,
					'timestamp': timestamp,
					'lastposttime': 0,
					'postcount': 0,
					'viewcount': 0,
					'locked': 0,
					'deleted': 0,
					'pinned': 0
				};

				if (data.thumb) {
					topicData.thumb = data.thumb;
				}

				plugins.fireHook('filter:topic.create', {topic: topicData}, next);
			},
			function(data, next) {
				topicData = data.topic;
				db.setObject('topic:' + topicData.tid, topicData, next);
			},
			function(next) {
				async.parallel([
					function(next) {
						db.sortedSetsAdd([
							'topics:tid',
							'cid:' + topicData.cid + ':tids',
							'cid:' + topicData.cid + ':uid:' + topicData.uid + ':tids'
						], timestamp, topicData.tid, next);
					},
					function(next) {
						user.addTopicIdToUser(topicData.uid, topicData.tid, timestamp, next);
					},
					function(next) {
						db.incrObjectField('category:' + topicData.cid, 'topic_count', next);
					},
					function(next) {
						db.incrObjectField('global', 'topicCount', next);
					},
					function(next) {
						Topics.createTags(data.tags, topicData.tid, timestamp, next);
					}
				], next);
			},
			function(results, next) {
				plugins.fireHook('action:topic.save', topicData);
				next(null, topicData.tid);
			}
		], callback);
	};

	Topics.post = function(data, callback) {
		var uid = data.uid;
		var title = data.title ? data.title.trim() : data.title;
		data.tags = data.tags || [];

		async.waterfall([
			function(next) {
				checkTitleLength(title, next);
			},
			function(next) {
				checkTagsLength(data.tags, next);
			},
			function(next) {
				checkContentLength(data.content, next);
			},
			function(next) {
				categories.exists(data.cid, next);
			},
			function(categoryExists, next) {
				if (!categoryExists) {
					return next(new Error('[[error:no-category]]'));
				}
				privileges.categories.can('topics:create', data.cid, data.uid, next);
			},
			function(canCreate, next) {
				if (!canCreate) {
					return next(new Error('[[error:no-privileges]]'));
				}

				if (!guestHandleValid(data)) {
					return next(new Error('[[error:guest-handle-invalid]]'));
				}

				user.isReadyToPost(data.uid, data.cid, next);
			},
			function(next) {
				plugins.fireHook('filter:topic.post', data, next);
			},
			function(filteredData, next) {
				data = filteredData;
				Topics.create({uid: data.uid, title: data.title, cid: data.cid, thumb: data.thumb, tags: data.tags, timestamp: data.timestamp}, next);
			},
			function(tid, next) {
				posts.create({uid: data.uid, tid: tid, handle: data.handle, content: data.content, timestamp: data.timestamp, ip: data.req ? data.req.ip : null}, next);
			},
			function(postData, next) {
				onNewPost(postData, data, next);
			},
			function(postData, next) {
				async.parallel({
					postData: function(next) {
						next(null, postData);
					},
					settings: function(next) {
						user.getSettings(uid, function(err, settings) {
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
					topicData: function(next) {
						Topics.getTopicsByTids([postData.tid], uid, next);
					}
				}, next);
			},
			function(data, next) {
				if (!Array.isArray(data.topicData) || !data.topicData.length) {
					return next(new Error('[[error:no-topic]]'));
				}

				data.topicData = data.topicData[0];
				data.topicData.unreplied = 1;
				data.topicData.mainPost = data.postData;
				data.postData.index = 0;

				plugins.fireHook('action:topic.post', data.topicData);

				if (parseInt(uid, 10)) {
					user.notifications.sendTopicNotificationToFollowers(uid, data.topicData, data.postData);
				}

				next(null, {
					topicData: data.topicData,
					postData: data.postData
				});
			}
		], callback);
	};

	Topics.reply = function(data, callback) {
		var tid = data.tid,
			uid = data.uid,
			content = data.content,
			postData;

		var cid;
		async.waterfall([
			function(next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function(_cid, next) {
				cid = _cid;
				async.parallel({
					exists: async.apply(Topics.exists, tid),
					locked: async.apply(Topics.isLocked, tid),
					canReply: async.apply(privileges.topics.can, 'topics:reply', tid, uid),
					isAdmin: async.apply(user.isAdministrator, uid),
					isModerator: async.apply(user.isModerator, uid, cid)
				}, next);
			},
			function(results, next) {
				if (!results.exists) {
					return next(new Error('[[error:no-topic]]'));
				}

				if (results.locked && !results.isAdmin && !results.isModerator) {
					return next(new Error('[[error:topic-locked]]'));
				}

				if (!results.canReply) {
					return next(new Error('[[error:no-privileges]]'));
				}

				if (!guestHandleValid(data)) {
					return next(new Error('[[error:guest-handle-invalid]]'));
				}

				user.isReadyToPost(uid, cid, next);
			},
			function(next) {
				plugins.fireHook('filter:topic.reply', data, next);
			},
			function(filteredData, next) {
				content = filteredData.content || data.content;
				if (content) {
					content = content.trim();
				}

				checkContentLength(content, next);
			},
			function(next) {
				posts.create({uid: uid, tid: tid, handle: data.handle, content: content, toPid: data.toPid, timestamp: data.timestamp, ip: data.req ? data.req.ip : null}, next);
			},
			function(_postData, next) {
				postData = _postData;
				onNewPost(postData, data, next);
			},
			function(postData, next) {
				user.getSettings(uid, next);
			},
			function(settings, next) {
				if (settings.followTopicsOnReply) {
					Topics.follow(postData.tid, uid);
				}

				posts.getPidIndex(postData.pid, postData.tid, settings.topicPostSort, next);
			},
			function(postIndex, next) {
				postData.index = postIndex;

				if (parseInt(uid, 10)) {
					Topics.notifyFollowers(postData, uid);
					user.setUserField(uid, 'lastonline', Date.now());
				}

				plugins.fireHook('action:topic.reply', postData);

				next(null, postData);
			}
		], callback);
	};

	function onNewPost(postData, data, callback) {
		var tid = postData.tid;
		var uid = postData.uid;
		async.waterfall([
			function(next) {
				Topics.markAsUnreadForAll(tid, next);
			},
			function(next) {
				Topics.markAsRead([tid], uid, next);
			},
			function(next) {
				async.parallel({
					userInfo: function(next) {
						posts.getUserInfoForPosts([postData.uid], uid, next);
					},
					topicInfo: function(next) {
						Topics.getTopicFields(tid, ['tid', 'title', 'slug', 'cid', 'postcount'], next);
					},
					content: function(next) {
						posts.parsePost(postData, next);
					}
				}, next);
			},
			function(results, next) {
				postData.user = results.userInfo[0];
				postData.topic = results.topicInfo;

				// Username override for guests, if enabled
				if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(postData.uid, 10) === 0 && data.handle) {
					postData.user.username = validator.escape(data.handle);
				}

				postData.favourited = false;
				postData.votes = 0;
				postData.display_moderator_tools = true;
				postData.display_move_tools = true;
				postData.selfPost = false;
				postData.relativeTime = utils.toISOString(postData.timestamp);
				postData.topic.title = validator.escape(postData.topic.title);

				next(null, postData);
			}
		], callback);
	}

	function checkTitleLength(title, callback) {
		if (!title || title.length < parseInt(meta.config.minimumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
		} else if (title.length > parseInt(meta.config.maximumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]'));
		}
		callback();
	}

	function checkTagsLength(tags, callback) {
		if (!tags || tags.length < parseInt(meta.config.minimumTagsPerTopic, 10)) {
			return callback(new Error('[[error:not-enough-tags, ' + meta.config.minimumTagsPerTopic + ']]'));
		} else if (tags.length > parseInt(meta.config.maximumTagsPerTopic, 10)) {
			return callback(new Error('[[error:too-many-tags, ' + meta.config.maximumTagsPerTopic + ']]'));
		}
		callback();
	}

	function checkContentLength(content, callback) {
		if (!content || content.length < parseInt(meta.config.miminumPostLength, 10)) {
			return callback(new Error('[[error:content-too-short, '  + meta.config.minimumPostLength + ']]'));
		} else if (content.length > parseInt(meta.config.maximumPostLength, 10)) {
			return callback(new Error('[[error:content-too-long, '  + meta.config.maximumPostLength + ']]'));
		}
		callback();
	}

	function guestHandleValid(data) {
		if (parseInt(meta.config.allowGuestHandles, 10) === 1 && parseInt(data.uid, 10) === 0 &&
			data.handle && data.handle.length > meta.config.maximumUsernameLength) {
			return false;
		}
		return true;
	}

};
