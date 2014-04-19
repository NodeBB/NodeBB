
'use strict';

var topics = require('../topics'),
	categories = require('../categories'),
	threadTools = require('../threadTools'),
	index = require('./index'),
	user = require('../user'),
	db = require('./../database'),
	meta = require('./../meta'),
	utils = require('../../public/src/utils'),

	async = require('async'),

	SocketTopics = {};

SocketTopics.post = function(socket, data, callback) {

	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	if (!socket.uid && !parseInt(meta.config.allowGuestPosting, 10)) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	topics.post({uid: socket.uid, title: data.title, content: data.content, cid: data.category_id, thumb: data.topic_thumb}, function(err, result) {
		if(err) {
			return callback(err);
		}

		if (result) {

			index.server.sockets.in('category_' + data.category_id).emit('event:new_topic', result.topicData);
			index.server.sockets.in('recent_posts').emit('event:new_topic', result.topicData);
			index.server.sockets.in('home').emit('event:new_topic', result.topicData);
			index.server.sockets.in('home').emit('event:new_post', {
				posts: result.postData
			});
			index.server.sockets.in('user/' + socket.uid).emit('event:new_post', {
				posts: result.postData
			});

			module.parent.exports.emitTopicPostStats();

			callback();
		}
	});
};

SocketTopics.postcount = function(socket, tid, callback) {
	topics.getTopicField(tid, 'postcount', callback);
};

SocketTopics.markAsRead = function(socket, data) {
	if(!data || !data.tid || !data.uid) {
		return;
	}

	topics.markAsRead(data.tid, data.uid, function(err) {
		topics.pushUnreadCount(data.uid);
		topics.markTopicNotificationsRead(data.tid, data.uid);
	});
};

SocketTopics.markTidsRead = function(socket, tids, callback) {

	if (!Array.isArray(tids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.markTidsRead(socket.uid, tids, function(err) {
		if(err) {
			return callback(err);
		}

		topics.pushUnreadCount(socket.uid);

		for (var i=0; i<tids.length; ++i) {
			topics.markTopicNotificationsRead(tids[i], socket.uid);
		}

		callback();
	});
};

SocketTopics.markAllRead = function(socket, data, callback) {
	topics.getUnreadTids(socket.uid, 0, -1, function(err, tids) {
		if (err) {
			return callback(err);
		}

		SocketTopics.markTidsRead(socket, tids, callback);
	});
};

SocketTopics.markCategoryTopicsRead = function(socket, cid, callback) {
	topics.getUnreadTids(socket.uid, 0, -1, function(err, tids) {
		if (err) {
			return callback(err);
		}

		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});

		db.getObjectsFields(keys, ['tid', 'cid'], function(err, topicData) {
			if (err) {
				return callback(err);
			}

			tids = topicData.filter(function(topic) {
				return parseInt(topic.cid, 10) === parseInt(cid, 10);
			}).map(function(topic) {
				return topic.tid;
			});

			SocketTopics.markTidsRead(socket, tids, callback);
		});

	});
};

SocketTopics.markAsUnreadForAll = function(socket, tids, callback) {
	if(!Array.isArray(tids)) {
		return callback(new Error('[[error:invalid-tid]]'));
	}

	async.each(tids, function(tid, next) {
		topics.markAsUnreadForAll(tid, function(err) {
			if(err) {
				return next(err);
			}

			db.sortedSetAdd('topics:recent', Date.now(), tid, function(err) {
				if(err) {
					return next(err);
				}
				topics.pushUnreadCount();
				next();
			});
		});
	}, callback);
};

SocketTopics.delete = function(socket, tids, callback) {
	doTopicAction('delete', socket, tids, callback);
};

SocketTopics.restore = function(socket, tids, callback) {
	doTopicAction('restore', socket, tids, callback);
};

SocketTopics.lock = function(socket, tids, callback) {
	doTopicAction('lock', socket, tids, callback);
};

SocketTopics.unlock = function(socket, tids, callback) {
	doTopicAction('unlock', socket, tids, callback);
};

SocketTopics.pin = function(socket, tids, callback) {
	doTopicAction('pin', socket, tids, callback);
};

SocketTopics.unpin = function(socket, tids, callback) {
	doTopicAction('unpin', socket, tids, callback);
};

function doTopicAction(action, socket, tids, callback) {
	if(!tids) {
		return callback(new Error('[[error:invalid-tid]]'));
	}

	async.each(tids, function(tid, next) {
		threadTools.privileges(tid, socket.uid, function(err, privileges) {
			if(err) {
				return next(err);
			}

			if(!privileges || !privileges.editable) {
				return next(new Error('[[error:no-privileges]]'));
			}

			if(typeof threadTools[action] === 'function') {
				threadTools[action](tid, socket.uid, next);
			}
		});
	}, callback);
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
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if(!data || !data.pid || !data.tid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	threadTools.privileges(data.tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if(!(privileges.admin || privileges.moderator)) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		topics.movePostToTopic(data.pid, data.tid, callback);
	});
};

SocketTopics.move = function(socket, data, callback) {
	if(!data || !Array.isArray(data.tids) || !data.cid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	async.each(data.tids, function(tid, next) {
		var oldCid;
		async.waterfall([
			function(next) {
				threadTools.privileges(tid, socket.uid, next);
			},
			function(privileges, next) {
				if(!(privileges.admin || privileges.moderator)) {
					return next(new Error('[[error:no-privileges]]'));
				}
				next();
			},
			function(next) {
				topics.getTopicField(tid, 'cid', next);
			},
			function(cid, next) {
				oldCid = cid;
				threadTools.move(tid, data.cid, next);
			}
		], function(err) {
			if(err) {
				return next(err);
			}

			index.server.sockets.in('topic_' + tid).emit('event:topic_moved', {
				tid: tid
			});

			index.server.sockets.in('category_' + oldCid).emit('event:topic_moved', {
				tid: tid
			});

			next();
		});
	}, callback);
};

SocketTopics.followCheck = function(socket, tid, callback) {
	threadTools.isFollowing(tid, socket.uid, callback);
};

SocketTopics.follow = function(socket, tid, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	threadTools.toggleFollow(tid, socket.uid, callback);
};

SocketTopics.loadMore = function(socket, data, callback) {
	if(!data || !data.tid || !(parseInt(data.after, 10) >= 0))  {
		return callback(new Error('[[error:invalid-data]]'));
	}

	user.getSettings(socket.uid, function(err, settings) {
		if(err) {
			return callback(err);
		}

		var start = parseInt(data.after, 10),
			end = start + settings.postsPerPage - 1;

		async.parallel({
			posts: function(next) {
				topics.getTopicPosts(data.tid, start, end, socket.uid, false, next);
			},
			privileges: function(next) {
				threadTools.privileges(data.tid, socket.uid, next);
			}
		}, callback);
	});
};

SocketTopics.loadMoreRecentTopics = function(socket, data, callback) {
	if(!data || !data.term || !data.after) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	topics.getLatestTopics(socket.uid, start, end, data.term, callback);
};

SocketTopics.loadMoreUnreadTopics = function(socket, data, callback) {
	if(!data || !data.after) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	topics.getUnreadTopics(socket.uid, start, end, callback);
};

SocketTopics.loadMoreFromSet = function(socket, data, callback) {
	if(!data || !data.after || !data.set) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	topics.getTopicsFromSet(socket.uid, data.set, start, end, callback);
};

SocketTopics.loadTopics = function(socket, data, callback) {
	if(!data || !data.set || !utils.isNumber(data.start) || !utils.isNumber(data.end)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	topics.getTopicsFromSet(socket.uid, data.set, data.start, data.end, callback);
};

SocketTopics.getPageCount = function(socket, tid, callback) {
	topics.getPageCount(tid, socket.uid, callback);
};

SocketTopics.getTidPage = function(socket, tid, callback) {
	topics.getTidPage(tid, socket.uid, callback);
};

SocketTopics.getTidIndex = function(socket, tid, callback) {
	categories.getTopicIndex(tid, callback);
};

module.exports = SocketTopics;
