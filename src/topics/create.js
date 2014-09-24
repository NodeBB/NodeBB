
'use strict';

var async = require('async'),
	validator = require('validator'),
	db = require('../database'),
	utils = require('../../public/src/utils'),
	plugins = require('../plugins'),
	user = require('../user'),
	meta = require('../meta'),
	posts = require('../posts'),
	threadTools = require('../threadTools'),
	privileges = require('../privileges'),
	categories = require('../categories');

module.exports = function(Topics) {

	Topics.create = function(data, callback) {
		var uid = data.uid,
			title = data.title,
			cid = data.cid;

		db.incrObjectField('global', 'nextTid', function(err, tid) {
			if (err) {
				return callback(err);
			}

			var slug = utils.slugify(title),
				timestamp = Date.now();

			if (!slug.length) {
				return callback(new Error('[[error:invalid-title]]'));
			}

			slug = tid + '/' + slug;

			var topicData = {
				'tid': tid,
				'uid': uid,
				'cid': cid,
				'mainPid': 0,
				'title': title,
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

			db.setObject('topic:' + tid, topicData, function(err) {
				if (err) {
					return callback(err);
				}

				async.parallel([
					function(next) {
						db.sortedSetsAdd(['topics:tid', 'categories:' + cid + ':tid'], timestamp, tid, next);
					},
					function(next) {
						user.addTopicIdToUser(uid, tid, timestamp, next);
					},
					function(next) {
						db.incrObjectField('category:' + cid, 'topic_count', next);
					},
					function(next) {
						db.incrObjectField('global', 'topicCount', next);
					},
					function(next) {
						Topics.createTags(data.tags, tid, timestamp, next);
					}
				], function(err) {
					if (err) {
						return callback(err);
					}
					plugins.fireHook('action:topic.save', tid);
					callback(null, tid);
				});
			});
		});
	};

	Topics.post = function(data, callback) {
		var uid = data.uid,
			title = data.title,
			content = data.content,
			cid = data.cid;

		if (title) {
			title = title.trim();
		}

		if (!title || title.length < parseInt(meta.config.minimumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
		} else if(title.length > parseInt(meta.config.maximumTitleLength, 10)) {
			return callback(new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]'));
		}

		async.waterfall([
			function(next) {
				categories.exists(cid, next);
			},
			function(categoryExists, next) {
				if (!categoryExists) {
					return next(new Error('[[error:no-category]]'));
				}
				privileges.categories.can('topics:create', cid, uid, next);
			},
			function(canCreate, next) {
				if(!canCreate) {
					return next(new Error('[[error:no-privileges]]'));
				}
				user.isReadyToPost(uid, next);
			},
			function(next) {
				plugins.fireHook('filter:topic.post', data, next);
			},
			function(filteredData, next) {
				content = filteredData.content || data.content;
				Topics.create({uid: uid, title: title, cid: cid, thumb: data.thumb, tags: data.tags}, next);
			},
			function(tid, next) {
				Topics.reply({uid:uid, tid:tid, content:content, req: data.req}, next);
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
								threadTools.follow(postData.tid, uid, next);
							} else {
								next();
							}
						});
					},
					topicData: function(next) {
						Topics.getTopicsByTids([postData.tid], 0, next);
					}
				}, next);
			},
			function(data, next) {
				if(!Array.isArray(data.topicData) || !data.topicData.length) {
					return next(new Error('[[error:no-topic]]'));
				}

				data.topicData = data.topicData[0];
				data.topicData.unreplied = 1;

				plugins.fireHook('action:topic.post', data.topicData);

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
			toPid = data.toPid,
			content = data.content,
			postData;

		async.waterfall([
			function(next) {
				async.parallel({
					exists: function(next) {
						threadTools.exists(tid, next);
					},
					locked: function(next) {
						Topics.isLocked(tid, next);
					},
					canReply: function(next) {
						privileges.topics.can('topics:reply', tid, uid, next);
					}
				}, next);
			},
			function(results, next) {
				if (!results.exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				if (results.locked) {
					return next(new Error('[[error:topic-locked]]'));
				}
				if (!results.canReply) {
					return next(new Error('[[error:no-privileges]]'));
				}

				user.isReadyToPost(uid, next);
			},
			function(next) {
				plugins.fireHook('filter:topic.reply', data, next);
			},
			function(filteredData, next) {
				content = filteredData.content || data.content;
				if (content) {
					content = content.trim();
				}

				if (!content || content.length < parseInt(meta.config.miminumPostLength, 10)) {
					return callback(new Error('[[error:content-too-short, '  + meta.config.minimumPostLength + ']]'));
				}

				posts.create({uid:uid, tid:tid, content:content, toPid:toPid}, next);
			},
			function(data, next) {
				postData = data;
				Topics.markAsUnreadForAll(tid, next);
			},
			function(next) {
				Topics.markAsRead([tid], uid, next);
			},
			function(next) {
				async.parallel({
					userInfo: function(next) {
						posts.getUserInfoForPosts([postData.uid], next);
					},
					topicInfo: function(next) {
						Topics.getTopicFields(tid, ['tid', 'title', 'slug', 'cid'], next);
					},
					settings: function(next) {
						user.getSettings(uid, next);
					},
					postIndex: function(next) {
						posts.getPidIndex(postData.pid, uid, next);
					}
				}, next);
			},
			function(results, next) {
				postData.user = results.userInfo[0];
				results.topicInfo.title = validator.escape(results.topicInfo.title);
				postData.topic = results.topicInfo;

				if (results.settings.followTopicsOnReply) {
					threadTools.follow(postData.tid, uid);
				}
				postData.index = results.postIndex - 1;
				postData.favourited = false;
				postData.votes = 0;
				postData.display_moderator_tools = true;
				postData.display_move_tools = true;
				postData.selfPost = false;
				postData.relativeTime = utils.toISOString(postData.timestamp);

				if (parseInt(uid, 10)) {
					Topics.notifyFollowers(tid, postData.pid, uid);

					user.notifications.sendPostNotificationToFollowers(uid, tid, postData.pid);
				}

				next(null, postData);
			}
		], callback);
	};

};
