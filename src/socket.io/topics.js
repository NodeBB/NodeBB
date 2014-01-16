var topics = require('../topics'),
	threadTools = require('../threadTools'),
	index = require('./index'),
	SocketTopics = {};

SocketTopics.post = function(socket, data, callback) {

	if (socket.uid < 1 && parseInt(meta.config.allowGuestPosting, 10) === 0) {
		socket.emit('event:alert', {
			title: 'Post Unsuccessful',
			message: 'You don&apos;t seem to be logged in, so you cannot reply.',
			type: 'danger',
			timeout: 2000
		});
		return;
	}

	topics.post(socket.uid, data.title, data.content, data.category_id, function(err, result) {
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
			index.server.sockets.in('category_' + data.category_id).emit('event:new_topic', result.topicData);
			index.server.sockets.in('recent_posts').emit('event:new_topic', result.topicData);
			index.server.sockets.in('user/' + socket.uid).emit('event:new_post', {
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

SocketTopics.postcount = function(socket, tid, callback) {
	topics.getTopicField(tid, 'postcount', callback);
};

SocketTopics.markAllRead = function(socket, data, callback) {
	topics.markAllRead(socket.uid, function(err, success) {
		if (!err && success) {
			callback(true);
			index.server.sockets.in('uid_' + socket.uid).emit('event:unread.updateCount', 0);
		} else {
			callback(false);
		}
	});
};

SocketTopics.delete = function(socket, data, callback) {
	threadTools.privileges(data.tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if(!privileges.editable) {
			return callback(new Error('not-allowed'));
		}

		threadTools.delete(data.tid, socket.uid, function(err) {
			if(err) {
				return callback(err);
			}

			module.parent.exports.emitTopicPostStats();


			callback(null, 'topic.delete', {
				status: 'ok',
				tid: data.tid
			});
		});
	});
};

SocketTopics.restore = function(socket, data, callback) {
	threadTools.privileges(data.tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if(!privileges.editable) {
			return callback(new Error('not-allowed'));
		}

		threadTools.restore(data.tid, socket.uid, function(err) {
			if(err) {
				return callback(err);
			}

			module.parent.exports.emitTopicPostStats();

			callback(null, 'topic.restore', {
				status: 'ok',
				tid: data.tid
			});
		});

	});
};

SocketTopics.lock = function(socket, data, callback) {
	threadTools.privileges(data.tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if (!privileges.editable) {
			return callback(new Error('not-allowed'));
		}

		threadTools.lock(data.tid, callback);
	});
};

SocketTopics.unlock = function(socket, data, callback) {
	threadTools.privileges(data.tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if (!privileges.editable) {
			return callback(new Error('not-allowed'));
		}

		threadTools.unlock(data.tid, callback);
	});
};

SocketTopics.pin = function(socket, data, callback) {
	threadTools.privileges(data.tid, sessionData.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if (!privileges.editable) {
			return callback(new Error('not-allowed'));
		}

		threadTools.pin(data.tid, callback);
	});
};

SocketTopics.unpin = function(socket, data, callback) {
	threadTools.privileges(data.tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if (!privileges.editable) {
			return callback(new Error('not-allowed'));
		}

		threadTools.unpin(data.tid, callback);
	});
};

SocketTopics.createTopicFromPosts = function(socket, data, callback) {
	if(!socket.uid) {
		socket.emit('event:alert', {
			title: 'Can&apos;t fork',
			message: 'Guests can&apos;t fork topics!',
			type: 'warning',
			timeout: 2000
		});
		return;
	}

	topics.createTopicFromPosts(socket.uid, data.title, data.pids, function(err, data) {
		callback(err, data);
	});
};

SocketTopics.movePost = function(socket, data, callback) {
	if(!socket.uid) {
		socket.emit('event:alert', {
			title: 'Can&apos;t fork',
			message: 'Guests can&apos;t fork topics!',
			type: 'warning',
			timeout: 2000
		});
		return;
	}

	topics.movePostToTopic(data.pid, data.tid, function(err, data) {
		callback(err, data);
	});
};

SocketTopics.move = function(socket, data, callback) {
	threadTools.move(data.tid, data.cid, function(err) {
		if(err) {
			return callback(err);
		}

		index.server.sockets.in('topic_' + data.tid).emit('event:topic_moved', {
			tid: tid
		});
	});
};

SocketTopics.followCheck = function(socket, tid, callback) {
	threadTools.isFollowing(tid, socket.uid, function(following) {
		callback(following);
	});
};

SocketTopics.follow = function(socket, tid, callback) {
	if (socket.uid) {
		threadTools.toggleFollow(tid, socket.uid, function(follow) {
			if (follow.status === 'ok') {
				callback(follow);
			}
		});
	} else {
		callback({
			status: 'error',
			error: 'not-logged-in'
		});
	}
};

SocketTopics.loadMore = function(socket, data, callback) {
	var start = data.after,
		end = start + 9;

	topics.getTopicPosts(data.tid, start, end, socket.uid, function(err, posts) {
		if(err) {
			return callback(err);

		}
		callback(null, {
			posts: posts
		});
	});
};

SocketTopics.loadMoreRecentTopics = function(socket, data, callback) {
	var start = data.after,
		end = start + 9;

	topics.getLatestTopics(socket.uid, start, end, data.term, function(err, latestTopics) {
		if(err) {
			return callback(err);
		}

		callback(null, latestTopics);
	});
};

SocketTopics.loadMoreUnreadTopics = function(socket, data, callback) {
	var start = data.after,
		end = start + 9;

	topics.getUnreadTopics(socket.uid, start, end, function(unreadTopics) {
		callback(null, unreadTopics);
	});
};

module.exports = SocketTopics;