
'use strict';

var nconf = require('nconf'),
	async = require('async'),
	winston = require('winston'),

	topics = require('../topics'),
	categories = require('../categories'),
	privileges = require('../privileges'),
	plugins = require('../plugins'),
	notifications = require('../notifications'),
	threadTools = require('../threadTools'),
	websockets = require('./index'),
	user = require('../user'),
	db = require('../database'),
	meta = require('../meta'),
	events = require('../events'),
	utils = require('../../public/src/utils'),


	SocketTopics = {};


SocketTopics.post = function(socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.post({
		uid: socket.uid,
		handle: data.handle,
		title: data.title,
		content: data.content,
		cid: data.category_id,
		thumb: data.topic_thumb,
		tags: data.tags,
		req: websockets.reqFromSocket(socket)
	}, function(err, result) {
		if (err) {
			return callback(err);
		}

		if (data.lock) {
			SocketTopics.doTopicAction('lock', 'event:topic_locked', socket, {tids: [result.topicData.tid], cid: result.topicData.cid});
		}

		callback(null, result.topicData);
		socket.emit('event:new_post', {posts: [result.postData]});
		socket.emit('event:new_topic', result.topicData);

		async.waterfall([
			function(next) {
				user.getUidsFromSet('users:online', 0, -1, next);
			},
			function(uids, next) {
				privileges.categories.filterUids('read', result.topicData.cid, uids, next);
			},
			function(uids, next) {
				plugins.fireHook('filter:sockets.sendNewPostToUids', {uidsTo: uids, uidFrom: data.uid, type: 'newTopic'}, next);
			}
		], function(err, data) {
			if (err) {
				return winston.error(err.stack);
			}

			var uids = data.uidsTo;

			for(var i=0; i<uids.length; ++i) {
				if (parseInt(uids[i], 10) !== socket.uid) {
					websockets.in('uid_' + uids[i]).emit('event:new_post', {posts: [result.postData]});
					websockets.in('uid_' + uids[i]).emit('event:new_topic', result.topicData);
				}
			}
		});
	});
};

SocketTopics.enter = function(socket, tid, callback) {
	if (!parseInt(tid, 10) || !socket.uid) {
		return;
	}
	async.parallel({
		markAsRead: function(next) {
			SocketTopics.markAsRead(socket, [tid], next);
		},
		users: function(next) {
			websockets.getUsersInRoom(socket.uid, 'topic_' + tid, next);
		}
	}, function(err, result) {
		callback(err, result ? result.users : null);
	});
};

SocketTopics.postcount = function(socket, tid, callback) {
	topics.getTopicField(tid, 'postcount', callback);
};

SocketTopics.markAsRead = function(socket, tids, callback) {
	if(!Array.isArray(tids) || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!tids.length) {
		return callback();
	}
	tids = tids.filter(function(tid) {
		return tid && utils.isNumber(tid);
	});

	topics.markAsRead(tids, socket.uid, function(err) {
		if (err) {
			return callback(err);
		}

		topics.pushUnreadCount(socket.uid);

		for (var i=0; i<tids.length; ++i) {
			topics.markTopicNotificationsRead(tids[i], socket.uid);
		}
		callback();
	});
};

SocketTopics.markTopicNotificationsRead = function(socket, tid, callback) {
	if(!tid || !socket.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	topics.markTopicNotificationsRead(tid, socket.uid);
};

SocketTopics.markAllRead = function(socket, data, callback) {
	topics.getLatestTidsFromSet('topics:recent', 0, -1, 'day', function(err, tids) {
		if (err) {
			return callback(err);
		}

		SocketTopics.markAsRead(socket, tids, callback);
	});
};

SocketTopics.markCategoryTopicsRead = function(socket, cid, callback) {
	topics.getUnreadTids(socket.uid, 0, -1, function(err, tids) {
		if (err) {
			return callback(err);
		}

		topics.getTopicsFields(tids, ['tid', 'cid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			tids = topicData.filter(function(topic) {
				return topic && parseInt(topic.cid, 10) === parseInt(cid, 10);
			}).map(function(topic) {
				return topic.tid;
			});

			SocketTopics.markAsRead(socket, tids, callback);
		});
	});
};

SocketTopics.markAsUnreadForAll = function(socket, tids, callback) {
	if (!Array.isArray(tids)) {
		return callback(new Error('[[error:invalid-tid]]'));
	}

	if (!socket.uid) {
		return callback(new Error('[[error:no-privileges]]'));
	}

	user.isAdministrator(socket.uid, function(err, isAdmin) {
		if (err) {
			return callback(err);
		}

		async.each(tids, function(tid, next) {
			async.waterfall([
				function(next) {
					topics.exists(tid, next);
				},
				function(exists, next) {
					if (!exists) {
						return next(new Error('[[error:invalid-tid]]'));
					}
					topics.getTopicField(tid, 'cid', next);
				},
				function(cid, next) {
					user.isModerator(socket.uid, cid, next);
				},
				function(isMod, next) {
					if (!isAdmin && !isMod) {
						return next(new Error('[[error:no-privileges]]'));
					}
					topics.markAsUnreadForAll(tid, next);
				},
				function(next) {
					topics.updateRecent(tid, Date.now(), next);
				}
			], next);
		}, function(err) {
			if (err) {
				return callback(err);
			}
			topics.pushUnreadCount(socket.uid);
			callback();
		});
	});
};

SocketTopics.delete = function(socket, data, callback) {
	SocketTopics.doTopicAction('delete', 'event:topic_deleted', socket, data, callback);
};

SocketTopics.restore = function(socket, data, callback) {
	SocketTopics.doTopicAction('restore', 'event:topic_restored', socket, data, callback);
};

SocketTopics.purge = function(socket, data, callback) {
	SocketTopics.doTopicAction('purge', 'event:topic_purged', socket, data, callback);
};

SocketTopics.lock = function(socket, data, callback) {
	SocketTopics.doTopicAction('lock', 'event:topic_locked', socket, data, callback);
};

SocketTopics.unlock = function(socket, data, callback) {
	SocketTopics.doTopicAction('unlock', 'event:topic_unlocked', socket, data, callback);
};

SocketTopics.pin = function(socket, data, callback) {
	SocketTopics.doTopicAction('pin', 'event:topic_pinned', socket, data, callback);
};

SocketTopics.unpin = function(socket, data, callback) {
	SocketTopics.doTopicAction('unpin', 'event:topic_unpinned', socket, data, callback);
};

SocketTopics.doTopicAction = function(action, event, socket, data, callback) {
	callback = callback || function() {};
	if (!socket.uid) {
		return;
	}
	if(!data || !Array.isArray(data.tids) || !data.cid) {
		return callback(new Error('[[error:invalid-tid]]'));
	}

	async.each(data.tids, function(tid, next) {
		privileges.topics.canEdit(tid, socket.uid, function(err, canEdit) {
			if (err) {
				return next(err);
			}

			if (!canEdit) {
				return next(new Error('[[error:no-privileges]]'));
			}

			if (typeof threadTools[action] !== 'function') {
				return next();
			}

			threadTools[action](tid, socket.uid, function(err, data) {
				if (err) {
					return next(err);
				}

				emitToTopicAndCategory(event, data);

				if (action === 'delete' || action === 'restore' || action === 'purge') {
					events.log({
						type: 'topic-' + action,
						uid: socket.uid,
						ip: socket.ip,
						tid: tid
					});
				}

				next();
			});
		});
	}, callback);
};

function emitToTopicAndCategory(event, data) {
	websockets.in('topic_' + data.tid).emit(event, data);
	websockets.in('category_' + data.cid).emit(event, data);
}

SocketTopics.createTopicFromPosts = function(socket, data, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if(!data || !data.title || !data.pids || !Array.isArray(data.pids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.createTopicFromPosts(socket.uid, data.title, data.pids, callback);
};

SocketTopics.movePost = function(socket, data, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if (!data || !data.pid || !data.tid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	privileges.posts.canMove(data.pid, socket.uid, function(err, canMove) {
		if (err || !canMove) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		topics.movePostToTopic(data.pid, data.tid, function(err) {
			if (err) {
				return callback(err);
			}

			require('./posts').sendNotificationToPostOwner(data.pid, socket.uid, 'notifications:moved_your_post');
			callback();
		});
	});
};

SocketTopics.move = function(socket, data, callback) {
	if(!data || !Array.isArray(data.tids) || !data.cid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.eachLimit(data.tids, 10, function(tid, next) {
		var oldCid;
		async.waterfall([
			function(next) {
				privileges.topics.canMove(tid, socket.uid, next);
			},
			function(canMove, next) {
				if (!canMove) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			},
			function(next) {
				topics.getTopicField(tid, 'cid', next);
			},
			function(cid, next) {
				oldCid = cid;
				threadTools.move(tid, data.cid, socket.uid, next);
			}
		], function(err) {
			if(err) {
				return next(err);
			}

			websockets.in('topic_' + tid).emit('event:topic_moved', {
				tid: tid
			});

			websockets.in('category_' + oldCid).emit('event:topic_moved', {
				tid: tid
			});

			SocketTopics.sendNotificationToTopicOwner(tid, socket.uid, 'notifications:moved_your_topic');

			next();
		});
	}, callback);
};


SocketTopics.sendNotificationToTopicOwner = function(tid, fromuid, notification) {
	if(!tid || !fromuid) {
		return;
	}

	async.parallel({
		username: async.apply(user.getUserField, fromuid, 'username'),
		topicData: async.apply(topics.getTopicFields, tid, ['uid', 'slug']),
	}, function(err, results) {
		if (err || fromuid === parseInt(results.topicData.uid, 10)) {
			return;
		}

		notifications.create({
			bodyShort: '[[' + notification + ', ' + results.username + ']]',
			path: nconf.get('relative_path') + '/topic/' + results.topicData.slug,
			nid: 'tid:' + tid + ':uid:' + fromuid,
			from: fromuid
		}, function(err, notification) {
			if (!err && notification) {
				notifications.push(notification, [results.topicData.uid]);
			}
		});
	});
};


SocketTopics.moveAll = function(socket, data, callback) {
	if(!data || !data.cid || !data.currentCid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	privileges.categories.canMoveAllTopics(data.currentCid, data.cid, data.uid, function(err, canMove) {
		if (err || canMove) {
			return callback(err || new Error('[[error:no-privileges]]'));
		}

		categories.getTopicIds('cid:' + data.currentCid + ':tids', true, 0, -1, function(err, tids) {
			if (err) {
				return callback(err);
			}

			async.eachLimit(tids, 10, function(tid, next) {
				threadTools.move(tid, data.cid, socket.uid, next);
			}, callback);
		});
	});
};

SocketTopics.toggleFollow = function(socket, tid, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	topics.toggleFollow(tid, socket.uid, callback);
};

SocketTopics.follow = function(socket, tid, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	topics.follow(tid, socket.uid, callback);
};

SocketTopics.loadMore = function(socket, data, callback) {
	if(!data || !data.tid || !utils.isNumber(data.after) || parseInt(data.after, 10) < 0)  {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.parallel({
		settings: function(next) {
			user.getSettings(socket.uid, next);
		},
		privileges: function(next) {
			privileges.topics.get(data.tid, socket.uid, next);
		},
		postCount: function(next) {
			topics.getPostCount(data.tid, next);
		},
		topic: function(next) {
			topics.getTopicFields(data.tid, ['deleted'], next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		if (!results.privileges.read || (parseInt(results.topic.deleted, 10) && !results.privileges.view_deleted)) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		var set = 'tid:' + data.tid + ':posts',
			reverse = false,
			start = Math.max(parseInt(data.after, 10) - 1, 0);

		if (results.settings.topicPostSort === 'newest_to_oldest' || results.settings.topicPostSort === 'most_votes') {
			reverse = true;
			data.after = results.postCount - 1 - data.after;
			start = Math.max(parseInt(data.after, 10), 0);
			if (results.settings.topicPostSort === 'most_votes') {
				set = 'tid:' + data.tid + ':posts:votes';
			}
		}

		var stop = start + results.settings.postsPerPage - 1;

		async.parallel({
			posts: function(next) {
				topics.getTopicPosts(data.tid, set, start, stop, socket.uid, reverse, next);
			},
			privileges: function(next) {
				next(null, results.privileges);
			},
			'reputation:disabled': function(next) {
				next(null, parseInt(meta.config['reputation:disabled'], 10) === 1);
			},
			'downvote:disabled': function(next) {
				next(null, parseInt(meta.config['downvote:disabled'], 10) === 1);
			}
		}, callback);
	});
};

SocketTopics.loadMoreUnreadTopics = function(socket, data, callback) {
	if (!data || !data.after) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		stop = start + 9;

	topics.getUnreadTopics(socket.uid, start, stop, callback);
};

SocketTopics.loadMoreFromSet = function(socket, data, callback) {
	if (!data || !data.after || !data.set) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		stop = start + 9;

	topics.getTopicsFromSet(data.set, socket.uid, start, stop, callback);
};

SocketTopics.loadTopics = function(socket, data, callback) {
	if (!data || !data.set || !utils.isNumber(data.start) || !utils.isNumber(data.stop)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.getTopicsFromSet(data.set, socket.uid, data.start, data.stop, callback);
};

SocketTopics.getPageCount = function(socket, tid, callback) {
	topics.getPageCount(tid, socket.uid, callback);
};

SocketTopics.searchTags = function(socket, data, callback) {
	topics.searchTags(data, callback);
};

SocketTopics.search = function(socket, data, callback) {
	topics.search(data.tid, data.term, callback);
};

SocketTopics.searchAndLoadTags = function(socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	topics.searchAndLoadTags(data, callback);
};

SocketTopics.loadMoreTags = function(socket, data, callback) {
	if(!data || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		stop = start + 99;

	topics.getTags(start, stop, function(err, tags) {
		if (err) {
			return callback(err);
		}

		callback(null, {tags: tags, nextStart: stop + 1});
	});
};

SocketTopics.isModerator = function(socket, tid, callback) {
	topics.getTopicField(tid, 'cid', function(err, cid) {
		if (err) {
			return callback(err);
		}
		user.isModerator(socket.uid, cid, callback);
	});
};

module.exports = SocketTopics;
