"use strict";

var async = require('async'),
	gravatar = require('gravatar'),
	path = require('path'),
	nconf = require('nconf'),
	validator = require('validator'),
	S = require('string'),
	winston = require('winston'),

	db = require('./database'),
	posts = require('./posts'),
	utils = require('./../public/src/utils'),
	plugins = require('./plugins'),
	user = require('./user'),
	categories = require('./categories'),
	categoryTools = require('./categoryTools'),
	posts = require('./posts'),
	threadTools = require('./threadTools'),
	postTools = require('./postTools'),
	notifications = require('./notifications'),
	favourites = require('./favourites'),
	meta = require('./meta'),
	Plugins = require('./plugins');

(function(Topics) {

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
				Plugins.fireHook('action:topic.save', tid);

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
				Topics.getTopicsByTids([postData.tid], uid, function(err, topicData) {
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

				user.sendPostNotificationToFollowers(uid, tid, postData.pid);

				next();
			},
			function(next) {
				Topics.markAsUnreadForAll(tid, next);
			},
			function(next) {
				Topics.markAsRead(tid, uid, next);
			},
			function(next) {
				Topics.pushUnreadCount();
				posts.addUserInfoToPost(postData, next);
			},
			function(postData,next) {
				posts.getPidIndex(postData.pid, next);
			},
			function(index, next) {
				postData.index = index;
				postData.favourited = false;
				postData.votes = 0;
				postData.display_moderator_tools = true;
				postData.display_move_tools = privileges.admin || privileges.moderator;
				postData.relativeTime = utils.toISOString(postData.timestamp);

				next(null, postData);
			}
		], callback);
	};

	Topics.createTopicFromPosts = function(uid, title, pids, callback) {
		if(title) {
			title = title.trim();
		}

		if(!title) {
			return callback(new Error('invalid-title'));
		}

		if(!pids || !pids.length) {
			return callback(new Error('invalid-pids'));
		}

		pids.sort();
		var mainPid = pids[0];

		async.parallel({
			postData: function(callback) {
				posts.getPostData(mainPid, callback);
			},
			cid: function(callback) {
				posts.getCidByPid(mainPid, callback);
			}
		}, function(err, results) {
			Topics.create({uid: results.postData.uid, title: title, cid: results.cid}, function(err, tid) {
				if(err) {
					return callback(err);
				}

				async.eachSeries(pids, move, function(err) {
					if(err) {
						return callback(err);
					}

					Topics.getTopicData(tid, callback);
				});

				function move(pid, next) {
					postTools.privileges(pid, uid, function(err, privileges) {
						if(err) {
							return next(err);
						}

						if(privileges.editable) {
							Topics.movePostToTopic(pid, tid, next);
						} else {
							next();
						}
					});
				}
			});
		});
	};

	Topics.movePostToTopic = function(pid, tid, callback) {
		threadTools.exists(tid, function(err, exists) {
			if(err || !exists) {
				return callback(err || new Error('Topic doesn\'t exist'));
			}

			posts.getPostFields(pid, ['deleted', 'tid', 'timestamp'], function(err, postData) {
				if(err) {
					return callback(err);
				}

				if(!postData) {
					return callback(new Error('Post doesn\'t exist'));
				}

				Topics.removePostFromTopic(postData.tid, pid, function(err) {
					if(err) {
						return callback(err);
					}

					if(!parseInt(postData.deleted, 10)) {
						Topics.decreasePostCount(postData.tid);
						Topics.increasePostCount(tid);
					}

					posts.setPostField(pid, 'tid', tid);
					Topics.addPostToTopic(tid, pid, postData.timestamp, callback);
				});
			});
		});
	};

	Topics.getTopicData = function(tid, callback) {
		db.getObject('topic:' + tid, function(err, data) {
			if(err) {
				return callback(err, null);
			}

			if(data) {
				data.title = validator.escape(data.title);
				data.relativeTime = utils.toISOString(data.timestamp);
			}

			callback(null, data);
		});
	};

	Topics.getTopicDataWithUser = function(tid, callback) {
		Topics.getTopicData(tid, function(err, topic) {
			if (err || !topic) {
				return callback(err || new Error('topic doesn\'t exist'));
			}

			user.getUserFields(topic.uid, ['username', 'userslug', 'picture'] , function(err, userData) {
				if (err) {
					return callback(err);
				}

				if (!userData) {
					userData = {};
				}

				topic.username = userData.username || 'Anonymous';
				topic.userslug = userData.userslug || '';
				topic.picture = userData.picture || gravatar.url('', {}, true);
				callback(null, topic);
			});
		});
	};

	Topics.getTopicPosts = function(tid, start, end, uid, reverse, callback) {
		posts.getPostsByTid(tid, start, end, reverse, function(err, postData) {
			if(err) {
				return callback(err);
			}

			if (Array.isArray(postData) && !postData.length) {
				return callback(null, []);
			}

			for(var i=0; i<postData.length; ++i) {
				postData[i].index = start + i;
			}

			var pids = postData.map(function(post) {
				return post.pid;
			});

			async.parallel({
				favourites : function(next) {
					favourites.getFavouritesByPostIDs(pids, uid, next);
				},
				voteData : function(next) {
					favourites.getVoteStatusByPostIDs(pids, uid, next);
				},
				userData : function(next) {
					async.each(postData, posts.addUserInfoToPost, next);
				},
				privileges : function(next) {
					async.map(pids, function (pid, next) {
						postTools.privileges(pid, uid, next);
					}, next);
				}
			}, function(err, results) {
				if(err) {
					return callback(err);
				}

				for (var i = 0; i < postData.length; ++i) {
					postData[i].favourited = results.favourites[i];
					postData[i].upvoted = results.voteData[i].upvoted;
					postData[i].downvoted = results.voteData[i].downvoted;
					postData[i].votes = postData[i].votes || 0;
					postData[i].display_moderator_tools = parseInt(uid, 10) !== 0 && results.privileges[i].editable;
					postData[i].display_move_tools = results.privileges[i].move;

					if(parseInt(postData[i].deleted, 10) === 1 && !results.privileges[i].view_deleted) {
						postData[i].content = 'This post is deleted!';
					}
				}

				callback(null, postData);
			});
		});
	};

	Topics.getPageCount = function(tid, uid, callback) {
		db.sortedSetCard('tid:' + tid + ':posts', function(err, postCount) {
			if(err) {
				return callback(err);
			}
			if(!parseInt(postCount, 10)) {
				return callback(null, 1);
			}
			user.getSettings(uid, function(err, settings) {
				if(err) {
					return callback(err);
				}

				callback(null, Math.ceil(parseInt(postCount, 10) / settings.postsPerPage));
			});
		});
	};

	Topics.getTidPage = function(tid, uid, callback) {
		if(!tid) {
			return callback(new Error('invalid-tid'));
		}

		async.parallel({
			index: function(next) {
				categories.getTopicIndex(tid, next);
			},
			settings: function(next) {
				user.getSettings(uid, next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}
			callback(null, Math.ceil((results.index + 1) / results.settings.topicsPerPage));
		});
	};

	Topics.getCategoryData = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				callback(err);
			}

			categories.getCategoryData(cid, callback);
		});
	};

	function getTopics(set, uid, tids, callback) {
		var returnTopics = {
			topics: [],
			nextStart: 0
		};

		if (!tids || !tids.length) {
			return callback(null, returnTopics);
		}

		async.filter(tids, function(tid, next) {
			threadTools.privileges(tid, uid, function(err, privileges) {
				next(!err && privileges.read);
			});
		}, function(tids) {
			Topics.getTopicsByTids(tids, uid, function(err, topicData) {
				if(err) {
					return callback(err);
				}

				if(!topicData || !topicData.length) {
					return callback(null, returnTopics);
				}

				db.sortedSetRevRank(set, topicData[topicData.length - 1].tid, function(err, rank) {
					if(err) {
						return callback(err);
					}

					returnTopics.nextStart = parseInt(rank, 10) + 1;
					returnTopics.topics = topicData;
					callback(null, returnTopics);
				});
			});
		});
	}

	Topics.getLatestTids = function(start, end, term, callback) {
		var terms = {
			day: 86400000,
			week: 604800000,
			month: 2592000000
		};

		var since = terms.day;
		if(terms[term]) {
			since = terms[term];
		}

		var count = parseInt(end, 10) === -1 ? end : end - start + 1;

		db.getSortedSetRevRangeByScore(['topics:recent', '+inf', Date.now() - since, 'LIMIT', start, count], callback);
	};

	Topics.getLatestTopics = function(uid, start, end, term, callback) {
		Topics.getLatestTids(start, end, term, function(err, tids) {
			if(err) {
				return callback(err);
			}
			getTopics('topics:recent', uid, tids, callback);
		});
	};

	Topics.getTopicsFromSet = function(uid, set, start, end, callback) {
		db.getSortedSetRevRange(set, start, end, function(err, tids) {
			if(err) {
				return callback(err);
			}

			getTopics(set, uid, tids, callback);
		});
	};

	Topics.getTotalUnread = function(uid, callback) {
		Topics.getUnreadTids(uid, 0, 21, function(err, tids) {
			callback(err, {count: tids ? tids.length : 0});
		});
	};

	Topics.getUnreadTids = function(uid, start, stop, callback) {
		var unreadTids = [],
			done = false;

		uid = parseInt(uid, 10);
		if(uid === 0) {
			return callback(null, unreadTids);
		}

		async.whilst(function() {
			return unreadTids.length < 20 && !done;
		}, function(callback) {
			Topics.getLatestTids(start, stop, 'month', function(err, tids) {
				if (err) {
					return callback(err);
				}

				if (tids && !tids.length) {
					done = true;
					return callback();
				}

				Topics.hasReadTopics(tids, uid, function(err, read) {
					if(err) {
						return callback(err);
					}
					var newtids = tids.filter(function(tid, index, self) {
						return parseInt(read[index], 10) === 0;
					});

					async.filter(newtids, function(tid, next) {
						threadTools.privileges(tid, uid, function(err, privileges) {
							next(!err && privileges.read);
						});
					}, function(newtids) {
						unreadTids.push.apply(unreadTids, newtids);

						start = stop + 1;
						stop = start + 19;

						callback();
					});
				});
			});
		}, function(err) {
			callback(err, unreadTids);
		});
	};

	Topics.getUnreadTopics = function(uid, start, stop, callback) {

		var unreadTopics = {
			no_topics_message: '',
			show_markallread_button: 'hidden',
			nextStart : 0,
			topics: []
		};

		function sendUnreadTopics(topicIds) {

			Topics.getTopicsByTids(topicIds, uid, function(err, topicData) {
				if(err) {
					return callback(err);
				}

				db.sortedSetRevRank('topics:recent', topicData[topicData.length - 1].tid, function(err, rank) {
					if(err) {
						return callback(err);
					}

					unreadTopics.topics = topicData;
					unreadTopics.nextStart = parseInt(rank, 10) + 1;
					unreadTopics.no_topics_message = (!topicData || topicData.length === 0) ? '' : 'hidden';
					unreadTopics.show_markallread_button = topicData.length === 0 ? 'hidden' : '';

					callback(null, unreadTopics);
				});
			});
		}

		Topics.getUnreadTids(uid, start, stop, function(err, unreadTids) {
			if (err) {
				return callback(err);
			}

			if (unreadTids.length) {
				sendUnreadTopics(unreadTids);
			} else {
				callback(null, unreadTopics);
			}
		});
	};

	Topics.pushUnreadCount = function(uids, callback) {
		var	websockets = require('./socket.io');

		if (!uids) {
			uids = websockets.getConnectedClients();
		} else if (!Array.isArray(uids)) {
			uids = [uids];
		}

		uids = uids.filter(function(value) {
			return parseInt(value, 10) !== 0;
		});

		async.each(uids, function(uid, next) {
			Topics.getUnreadTids(uid, 0, 19, function(err, tids) {
				websockets.in('uid_' + uid).emit('event:unread.updateCount', null, tids);
				next();
			});
		}, function(err) {
			if (err) {
				winston.error(err.message);
			}

			if (callback) {
				callback();
			}
		});
	};

	Topics.getTopicsByTids = function(tids, uid, callback) {

		if (!Array.isArray(tids) || tids.length === 0) {
			return callback(null, []);
		}

		function getTopicInfo(topicData, callback) {
			async.parallel({
				hasread : function (next) {
					Topics.hasReadTopic(topicData.tid, uid, next);
				},
				teaser : function (next) {
					Topics.getTeaser(topicData.tid, next);
				},
				privileges : function (next) {
					categoryTools.privileges(topicData.cid, uid, next);
				},
				categoryData : function (next) {
					categories.getCategoryFields(topicData.cid, ['name', 'slug', 'icon'], next);
				}
			}, callback);
		}

		function isTopicVisible(topicData, topicInfo) {
			var deleted = parseInt(topicData.deleted, 10) !== 0;

			return !deleted || (deleted && topicInfo.privileges.view_deleted) || parseInt(topicData.uid, 10) === parseInt(uid, 10);
		}

		function loadTopic(tid, next) {

			Topics.getTopicDataWithUser(tid, function(err, topicData) {
				if(err) {
					return next(err);
				}

				if (!topicData) {
					return next();
				}

				getTopicInfo(topicData, function(err, topicInfo) {
					if(err) {
						return next(err);
					}

					if (!isTopicVisible(topicData, topicInfo)) {
						return next();
					}

					topicData.pinned = parseInt(topicData.pinned, 10) === 1;
					topicData.locked = parseInt(topicData.locked, 10) === 1;
					topicData.deleted = parseInt(topicData.deleted, 10) === 1;
					topicData.unread = !(topicInfo.hasread && parseInt(uid, 10) !== 0);
					topicData.unreplied = parseInt(topicData.postcount, 10) === 1;

					topicData.category = topicInfo.categoryData;
					topicData.teaser = topicInfo.teaser;

					next(null, topicData);
				});
			});
		}

		async.map(tids, loadTopic, function(err, topics) {
			if(err) {
				return callback(err);
			}

			topics = topics.filter(function(topic) {
				return !!topic;
			});

			callback(null, topics);
		});
	};

	Topics.getTopicWithPosts = function(tid, uid, start, end, callback) {
		threadTools.exists(tid, function(err, exists) {
			if (err || !exists) {
				return callback(err || new Error('Topic tid \'' + tid + '\' not found'));
			}

			async.parallel({
				topicData : function(next) {
					Topics.getTopicData(tid, next);
				},
				posts : function(next) {
					Topics.getTopicPosts(tid, start, end, uid, false, next);
				},
				privileges : function(next) {
					threadTools.privileges(tid, uid, next);
				},
				category : function(next) {
					Topics.getCategoryData(tid, next);
				},
				pageCount : function(next) {
					Topics.getPageCount(tid, uid, next);
				},
				threadTools : function(next) {
					Plugins.fireHook('filter:topic.thread_tools', [], next);
				}
			}, function(err, results) {
				if (err) {
					winston.error('[Topics.getTopicWithPosts] Could not retrieve topic data: ', err.message);
					return callback(err);
				}

				var topicData = results.topicData;
				topicData.category = results.category;
				topicData.posts = results.posts;
				topicData.thread_tools = results.threadTools;
				topicData.pageCount = results.pageCount;
				topicData.unreplied = parseInt(topicData.postcount, 10) === 1;
				topicData.expose_tools = results.privileges.editable ? 1 : 0;

				callback(null, topicData);
			});
		});
	};

	Topics.getAllTopics = function(start, end, callback) {
		db.getSortedSetRevRange('topics:tid', start, end, function(err, tids) {
			if(err) {
				return callback(err);
			}

			async.map(tids, function(tid, next) {
				Topics.getTopicDataWithUser(tid, next);
			}, callback);
		});
	};

	Topics.getTitleByPid = function(pid, callback) {
		Topics.getTopicFieldByPid('title', pid, callback);
	};

	Topics.getTopicFieldByPid = function(field, pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			Topics.getTopicField(tid, field, callback);
		});
	};

	Topics.getTopicDataByPid = function(pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			Topics.getTopicData(tid, callback);
		});
	};

	Topics.uploadTopicThumb = function(image, callback) {

		if(plugins.hasListeners('filter:uploadImage')) {
			plugins.fireHook('filter:uploadImage', image, callback);
		} else {
			if (meta.config.allowTopicsThumbnail) {
				var filename = 'upload-' + utils.generateUUID() + path.extname(image.name);
				require('./file').saveFileToLocal(filename, image.path, function(err, upload) {
					if(err) {
						return callback(err);
					}
					callback(null, {
						url: upload.url,
						name: image.name
					});
				});
			} else {
				callback(new Error('Topic Thumbnails are disabled!'));
			}
		}
	};

	Topics.markAsUnreadForAll = function(tid, callback) {
		db.delete('tid:' + tid + ':read_by_uid', function(err) {
			if(err) {
				return callback(err);
			}
			Topics.markCategoryUnreadForAll(tid, callback);
		});
	};

	Topics.markAllRead = function(uid, tids, callback) {
		if(!tids || !tids.length) {
			return callback();
		}

		async.each(tids, function (tid, next) {
			Topics.markAsRead(tid, uid, next);
		}, callback);
	};

	Topics.markAsRead = function(tid, uid, callback) {

		db.setAdd('tid:' + tid + ':read_by_uid', uid, function(err) {
			if(callback) {
				callback(err);
			}
		});

		Topics.getTopicField(tid, 'cid', function(err, cid) {
			categories.markAsRead(cid, uid);
		});

		user.notifications.getUnreadByUniqueId(uid, 'topic:' + tid, function(err, nids) {
			notifications.mark_read_multiple(nids, uid, function() {
				user.pushNotifCount(uid);
			});
		});
	};

	Topics.markCategoryUnreadForAll = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			categories.markAsUnreadForAll(cid, callback);
		});
	};

	Topics.hasReadTopics = function(tids, uid, callback) {
		if(!parseInt(uid, 10)) {
			return callback(null, tids.map(function() {
				return false;
			}));
		}

		var sets = [];

		for (var i = 0, ii = tids.length; i < ii; i++) {
			sets.push('tid:' + tids[i] + ':read_by_uid');
		}

		db.isMemberOfSets(sets, uid, callback);
	};

	Topics.hasReadTopic = function(tid, uid, callback) {
		if(!parseInt(uid, 10)) {
			return callback(null, false);
		}

		db.isSetMember('tid:' + tid + ':read_by_uid', uid, callback);
	};

	Topics.getTeasers = function(tids, callback) {

		if(!Array.isArray(tids)) {
			return callback(null, []);
		}

		async.map(tids, Topics.getTeaser, callback);
	};

	Topics.getTeaser = function(tid, callback) {
		threadTools.getLatestUndeletedPid(tid, function(err, pid) {
			if (err) {
				return callback(err);
			}

			if (!pid) {
				return callback(null, null);
			}

			posts.getPostFields(pid, ['pid', 'uid', 'timestamp'], function(err, postData) {
				if (err) {
					return callback(err);
				} else if(!postData) {
					return callback(new Error('no-teaser-found'));
				}

				user.getUserFields(postData.uid, ['username', 'userslug', 'picture'], function(err, userData) {
					if (err) {
						return callback(err);
					}

					callback(null, {
						pid: postData.pid,
						username: userData.username || 'anonymous',
						userslug: userData.userslug || '',
						picture: userData.picture || gravatar.url('', {}, true),
						timestamp: utils.toISOString(postData.timestamp)
					});
				});
			});
		});
	};

	Topics.getTopicField = function(tid, field, callback) {
		db.getObjectField('topic:' + tid, field, callback);
	};

	Topics.getTopicFields = function(tid, fields, callback) {
		db.getObjectFields('topic:' + tid, fields, callback);
	};

	Topics.setTopicField = function(tid, field, value, callback) {
		db.setObjectField('topic:' + tid, field, value, callback);
	};

	Topics.increasePostCount = function(tid, callback) {
		db.incrObjectField('topic:' + tid, 'postcount', function(err, value) {
			if(err) {
				return callback(err);
			}
			db.sortedSetAdd('topics:posts', value, tid, callback);
		});
	};

	Topics.decreasePostCount = function(tid, callback) {
		db.decrObjectField('topic:' + tid, 'postcount', function(err, value) {
			if(err) {
				return callback(err);
			}
			db.sortedSetAdd('topics:posts', value, tid, callback);
		});
	};

	Topics.increaseViewCount = function(tid, callback) {
		db.incrObjectField('topic:' + tid, 'viewcount', function(err, value) {
			if(err) {
				return callback(err);
			}
			db.sortedSetAdd('topics:views', value, tid, callback);
		});
	};

	Topics.isLocked = function(tid, callback) {
		Topics.getTopicField(tid, 'locked', function(err, locked) {
			if(err) {
				return callback(err);
			}
			callback(null, parseInt(locked, 10) === 1);
		});
	};

	Topics.updateTimestamp = function(tid, timestamp) {
		db.sortedSetAdd('topics:recent', timestamp, tid);
		Topics.setTopicField(tid, 'lastposttime', timestamp);
	};

	Topics.onNewPostMade = function(tid, pid, timestamp, callback) {
		Topics.increasePostCount(tid);
		Topics.updateTimestamp(tid, timestamp);
		Topics.addPostToTopic(tid, pid, timestamp, callback);
	};

	Topics.addPostToTopic = function(tid, pid, timestamp, callback) {
		db.sortedSetAdd('tid:' + tid + ':posts', timestamp, pid, callback);
	};

	Topics.removePostFromTopic = function(tid, pid, callback) {
		db.sortedSetRemove('tid:' + tid + ':posts', pid, callback);
	};

	Topics.getPids = function(tid, callback) {
		db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, callback);
	};

	Topics.getUids = function(tid, callback) {
		var uids = {};
		Topics.getPids(tid, function(err, pids) {

			function getUid(pid, next) {
				posts.getPostField(pid, 'uid', function(err, uid) {
					if (err) {
						return next(err);
					}
					uids[uid] = 1;
					next();
				});
			}

			async.each(pids, getUid, function(err) {
				if (err) {
					return callback(err);
				}

				callback(null, Object.keys(uids));
			});
		});
	};

	Topics.updateTopicCount = function(callback) {
		db.sortedSetCard('topics:recent', function(err, count) {
			if(err) {
				return callback(err);
			}

			db.setObjectField('global', 'topicCount', count, callback);
		});
	};

	Topics.delete = function(tid, callback) {
		async.parallel([
			function(next) {
				Topics.setTopicField(tid, 'deleted', 1, next);
			},
			function(next) {
				db.sortedSetRemove('topics:recent', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:posts', tid, next);
			},
			function(next) {
				db.sortedSetRemove('topics:views', tid, next);
			},
			function(next) {
				Topics.getTopicField(tid, 'cid', function(err, cid) {
					if(err) {
						return next(err);
					}
					db.incrObjectFieldBy('category:' + cid, 'topic_count', -1, next);
				});
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			Topics.updateTopicCount(callback);
		});
	};

	Topics.restore = function(tid, callback) {
		Topics.getTopicFields(tid, ['lastposttime', 'postcount', 'viewcount'], function(err, topicData) {
			if(err) {
				return callback(err);
			}

			async.parallel([
				function(next) {
					Topics.setTopicField(tid, 'deleted', 0, next);
				},
				function(next) {
					db.sortedSetAdd('topics:recent', topicData.lastposttime, tid, next);
				},
				function(next) {
					db.sortedSetAdd('topics:posts', topicData.postcount, tid, next);
				},
				function(next) {
					db.sortedSetAdd('topics:views', topicData.viewcount, tid, next);
				},
				function(next) {
					Topics.getTopicField(tid, 'cid', function(err, cid) {
						if(err) {
							return next(err);
						}
						db.incrObjectFieldBy('category:' + cid, 'topic_count', 1, next);
					});
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				Topics.updateTopicCount(callback);
			});
		});
	};
}(exports));