var topics = require('../topics'),
	threadTools = require('../threadTools'),

	SocketTopics = {};

SocketTopics.post = function(data, callback, sessionData) {
	var socket = sessionData.socket;

	if (sessionData.uid < 1 && parseInt(meta.config.allowGuestPosting, 10) === 0) {
		socket.emit('event:alert', {
			title: 'Post Unsuccessful',
			message: 'You don&apos;t seem to be logged in, so you cannot reply.',
			type: 'danger',
			timeout: 2000
		});
		return;
	}

	topics.post(sessionData.uid, data.title, data.content, data.category_id, function(err, result) {
		if(err) {
		 	if (err.message === 'title-too-short') {
				module.parent.exports.emitAlert(socket, 'Title too short', 'Please enter a longer title. At least ' + meta.config.minimumTitleLength + ' characters.');
			} else if (err.message === 'title-too-long') {
				module.parent.exports.emitAlert(socket, 'Title too long', 'Please enter a shorter title. Titles can\'t be longer than ' + meta.config.maximumTitleLength + ' characters.');
			} else if (err.message === 'content-too-short') {
				module.parent.exports.emitContentTooShortAlert(socket);
			} else if (err.message === 'too-many-posts') {
				module.parent.exports.emitTooManyPostsAlert(socket);
			} else if (err.message === 'no-privileges') {
				socket.emit('event:alert', {
					title: 'Unable to post',
					message: 'You do not have posting privileges in this category.',
					type: 'danger',
					timeout: 7500
				});
			} else {
				socket.emit('event:alert', {
					title: 'Error',
					message: err.message,
					type: 'warning',
					timeout: 7500
				});
			}
			return;
		}

		if (result) {
			sessionData.server.sockets.in('category_' + data.category_id).emit('event:new_topic', result.topicData);
			sessionData.server.sockets.in('recent_posts').emit('event:new_topic', result.topicData);
			sessionData.server.sockets.in('user/' + sessionData.uid).emit('event:new_post', {
				posts: result.postData
			});

			module.parent.exports.emitTopicPostStats();

			socket.emit('event:alert', {
				title: 'Thank you for posting',
				message: 'You have successfully posted. Click here to view your post.',
				type: 'success',
				timeout: 2000
			});
			callback();
		}
	});
};

SocketTopics.postcount = function(tid, callback) {
	topics.getTopicField(tid, 'postcount', callback);
};

SocketTopics.markAllRead = function(data, callback, sessionData) {
	topics.markAllRead(sessionData.uid, function(err, success) {
		if (!err && success) {
			callback(true);
			sessionData.server.sockets.in('uid_' + sessionData.uid).emit('event:unread.updateCount', 0);
		} else {
			callback(false);
		}
	});
};

SocketTopics.delete = function(data, callback, sessionData) {
	threadTools.privileges(data.tid, sessionData.uid, function(err, privileges) {
		if (!err && privileges.editable) {
			threadTools.delete(data.tid, sessionData.uid, function(err) {
				if (!err) {
					module.parent.exports.emitTopicPostStats();
					if (callback) {
						callback('api:topic.delete', {
							status: 'ok',
							tid: data.tid
						});
					}
				}
			});
		}
	});
};

SocketTopics.restore = function(data, callback, sessionData) {
	threadTools.privileges(data.tid, sessionData.uid, function(err, privileges) {
		if (!err && privileges.editable) {
			threadTools.restore(data.tid, sessionData.uid, function(err) {
				module.parent.exports.emitTopicPostStats();

				if (callback) {
					callback('api:topic.restore', {
						status: 'ok',
						tid: data.tid
					});
				}
			});
		}
	});
};

SocketTopics.lock = function(data, callback, sessionData) {
	threadTools.privileges(data.tid, sessionData.uid, function(err, privileges) {
		if (!err && privileges.editable) {
			threadTools.lock(data.tid, callback);
		}
	});
};

SocketTopics.unlock = function(data, callback, sessionData) {
	threadTools.privileges(data.tid, sessionData.uid, function(err, privileges) {
		if (!err && privileges.editable) {
			threadTools.unlock(data.tid, callback);
		}
	});
};

SocketTopics.pin = function(data, callback, sessionData) {
	threadTools.privileges(data.tid, sessionData.uid, function(err, privileges) {
		if (!err && privileges.editable) {
			threadTools.pin(data.tid, callback);
		}
	});
};

SocketTopics.unpin = function(data, callback, sessionData) {
	threadTools.privileges(data.tid, sessionData.uid, function(err, privileges) {
		if (!err && privileges.editable) {
			threadTools.unpin(data.tid, callback);
		}
	});
};

SocketTopics.createTopicFromPosts = function(data, callback, sessionData) {
	if(!sessionData.uid) {
		socket.emit('event:alert', {
			title: 'Can&apos;t fork',
			message: 'Guests can&apos;t fork topics!',
			type: 'warning',
			timeout: 2000
		});
		return;
	}

	topics.createTopicFromPosts(sessionData.uid, data.title, data.pids, function(err, data) {
		callback(err?{message:err.message}:null, data);
	});
};

SocketTopics.movePost = function(data, callback, sessionData) {
	if(!sessionData.uid) {
		socket.emit('event:alert', {
			title: 'Can&apos;t fork',
			message: 'Guests can&apos;t fork topics!',
			type: 'warning',
			timeout: 2000
		});
		return;
	}

	topics.movePostToTopic(data.pid, data.tid, function(err, data) {
		callback(err?{message:err.message}:null, data);
	});
};

SocketTopics.move = function(data, callback, sessionData) {
	threadTools.move(data.tid, data.cid, callback, sessionData);
};

SocketTopics.followCheck = function(tid, callback, sessionData) {
	threadTools.isFollowing(tid, sessionData.uid, function(following) {
		callback(following);
	});
};

SocketTopics.follow = function(tid, callback, sessionData) {
	if (sessionData.uid && sessionData.uid > 0) {
		threadTools.toggleFollow(tid, sessionData.uid, function(follow) {
			if (follow.status === 'ok') callback(follow);
		});
	} else {
		callback({
			status: 'error',
			error: 'not-logged-in'
		});
	}
};

SocketTopics.loadMore = function(data, callback, sessionData) {
	var start = data.after,
		end = start + 9;

	topics.getTopicPosts(data.tid, start, end, sessionData.uid, function(err, posts) {
		callback({
			posts: posts
		});
	});
};

SocketTopics.loadMoreRecentTopics = function(data, callback, sessionData) {
	var start = data.after,
		end = start + 9;

	topics.getLatestTopics(sessionData.uid, start, end, data.term, function(err, latestTopics) {
		if (!err) {
			callback(latestTopics);
		} else {
			winston.error('[socket api:topics.loadMoreRecentTopics] ' + err.message);
		}
	});
};

SocketTopics.loadMoreUnreadTopics = function(data, callback, sessionData) {
	var start = data.after,
		end = start + 9;

	topics.getUnreadTopics(sessionData.uid, start, end, function(unreadTopics) {
		callback(unreadTopics);
	});
};

module.exports = SocketTopics;