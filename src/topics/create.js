
'use strict';

var async = require('async'),
	db = require('./../database'),
	utils = require('./../../public/src/utils'),
	plugins = require('./../plugins'),
	user = require('./../user'),
	meta = require('./../meta'),
	posts = require('./../posts'),
	threadTools = require('./../threadTools'),
	categoryTools = require('./../categoryTools');

module.exports = function(Topics) {

	Topics.create = function(data, callback) {
		var uid = data.uid,
			title = data.title,
			cid = data.cid,
			thumb = data.thumb;

		db.incrObjectField('global', 'nextTid', function(err, tid) {
			if(err) {
				return callback(err);
			}

			var slug = tid + '/' + utils.slugify(title),
				timestamp = Date.now();

			var topicData = {
				'tid': tid,
				'uid': uid,
				'cid': cid,
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

			if(thumb) {
				topicData.thumb = thumb;
			}

			db.setObject('topic:' + tid, topicData, function(err) {
				if(err) {
					return callback(err);
				}

				db.sortedSetAdd('topics:tid', timestamp, tid);
				plugins.fireHook('action:topic.save', tid);

				user.addTopicIdToUser(uid, tid, timestamp);

				db.sortedSetAdd('categories:' + cid + ':tid', timestamp, tid);
				db.incrObjectField('category:' + cid, 'topic_count');
				db.incrObjectField('global', 'topicCount');

				callback(null, tid);
			});
		});
	};

	Topics.post = function(data, callback) {
		var uid = data.uid,
			title = data.title,
			content = data.content,
			cid = data.cid,
			thumb = data.thumb;

		if (title) {
			title = title.trim();
		}

		if (!title || title.length < parseInt(meta.config.minimumTitleLength, 10)) {
			return callback(new Error('title-too-short'));
		} else if(title.length > parseInt(meta.config.maximumTitleLength, 10)) {
			return callback(new Error('title-too-long'));
		}

		if (content) {
			content = content.trim();
		}

		if (!content || content.length < meta.config.miminumPostLength) {
			return callback(new Error('content-too-short'));
		}

		if (!cid) {
			return callback(new Error('invalid-cid'));
		}

		async.waterfall([
			function(next) {
				categoryTools.exists(cid, next);
			},
			function(categoryExists, next) {
				if (!categoryExists) {
					return next(new Error('category doesn\'t exist'));
				}
				categoryTools.privileges(cid, uid, next);
			},
			function(privileges, next) {
				if(!privileges.write) {
					return next(new Error('no-privileges'));
				}
				next();
			},
			function(next) {
				user.isReadyToPost(uid, next);
			},
			function(next) {
				Topics.create({uid: uid, title: title, cid: cid, thumb: thumb}, next);
			},
			function(tid, next) {
				Topics.reply({uid:uid, tid:tid, content:content}, next);
			},
			function(postData, next) {
				threadTools.toggleFollow(postData.tid, uid);
				next(null, postData);
			},
			function(postData, next) {
				Topics.getTopicsByTids([postData.tid], 0, function(err, topicData) {
					if(err) {
						return next(err);
					}
					if(!topicData || !topicData.length) {
						return next(new Error('no-topic'));
					}
					topicData = topicData[0];
					topicData.unreplied = 1;

					next(null, {
						topicData: topicData,
						postData: postData
					});
				});
			}
		], callback);
	};

	Topics.reply = function(data, callback) {
		var tid = data.tid,
			uid = data.uid,
			toPid = data.toPid,
			content = data.content,
			privileges,
			postData;

		async.waterfall([
			function(next) {
				threadTools.exists(tid, next);
			},
			function(topicExists, next) {
				if (!topicExists) {
					return next(new Error('topic doesn\'t exist'));
				}

				Topics.isLocked(tid, next);
			},
			function(locked, next) {
				if (locked) {
					return next(new Error('topic-locked'));
				}

				threadTools.privileges(tid, uid, next);
			},
			function(privilegesData, next) {
				privileges = privilegesData;
				if (!privileges.write) {
					return next(new Error('no-privileges'));
				}
				next();
			},
			function(next) {
				user.isReadyToPost(uid, next);
			},
			function(next) {
				if (content) {
					content = content.trim();
				}

				if (!content || content.length < meta.config.minimumPostLength) {
					return next(new Error('content-too-short'));
				}

				posts.create({uid:uid, tid:tid, content:content, toPid:toPid}, next);
			},
			function(data, next) {
				postData = data;
				threadTools.notifyFollowers(tid, postData.pid, uid);

				user.notifications.sendPostNotificationToFollowers(uid, tid, postData.pid);

				next();
			},
			function(next) {
				Topics.markAsUnreadForAll(tid, next);
			},
			function(next) {
				Topics.markAsRead(tid, uid, next);
			},
			function(result, next) {
				Topics.pushUnreadCount();
				posts.addUserInfoToPost(postData, next);
			},
			function(postData, next) {
				Topics.getTopicFields(tid, ['tid', 'title', 'slug'], next);
			},
			function(topicData, next) {
				postData.topic = topicData;
				next();
			},
			function(next) {
				posts.getPidIndex(postData.pid, next);
			},
			function(index, next) {
				postData.index = index;
				postData.favourited = false;
				postData.votes = 0;
				postData.display_moderator_tools = false;
				postData.display_move_tools = false;
				postData.relativeTime = utils.toISOString(postData.timestamp);

				next(null, postData);
			}
		], callback);
	};

};