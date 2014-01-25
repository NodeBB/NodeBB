var topics = require('../topics'),
	threadTools = require('../threadTools'),
	index = require('./index'),
	SocketTopics = {};

SocketTopics.post = function(socket, data, callback) {

	if(!data) {
		return callback(new Error('Invalid data'));
	}

	if (!socket.uid && !parseInt(meta.config.allowGuestPosting, 10)) {
		socket.emit('event:alert', {
			title: 'Post Unsuccessful',
			message: 'You don&apos;t seem to be logged in, so you cannot reply.',
			type: 'danger',
			timeout: 2000
		});
		return callback(new Error('not-logged-in'));
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
			return callback(err);
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
			callback(null);
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
	});
}

SocketTopics.markAllRead = function(socket, data, callback) {
	topics.markAllRead(socket.uid, function(err) {
		if(err) {
			return callback(err);
		}

		index.server.sockets.in('uid_' + socket.uid).emit('event:unread.updateCount', null, []);

		callback(null);
	});
};

SocketTopics.markAsUnreadForAll = function(socket, tid, callback) {
	topics.markAsUnreadForAll(tid, function(err) {
		if(err) {
			return callback(err);
		}
		topics.pushUnreadCount();
		callback();
	});
}

function doTopicAction(action, socket, tid, callback) {
	if(!tid) {
		return callback(new Error('Invalid tid'));
	}

	threadTools.privileges(tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if(!privileges || !privileges.editable) {
			return callback(new Error('not-allowed'));
		}

		if(threadTools[action]) {
			threadTools[action](tid, socket.uid, callback);
		}
	});
}

SocketTopics.delete = function(socket, tid, callback) {
	doTopicAction('delete', socket, tid, callback);
};

SocketTopics.restore = function(socket, tid, callback) {
	doTopicAction('restore', socket, tid, callback);
};

SocketTopics.lock = function(socket, tid, callback) {
	doTopicAction('lock', socket, tid, callback);
};

SocketTopics.unlock = function(socket, tid, callback) {
	doTopicAction('unlock', socket, tid, callback);
};

SocketTopics.pin = function(socket, tid, callback) {
	doTopicAction('pin', socket, tid, callback);
};

SocketTopics.unpin = function(socket, tid, callback) {
	doTopicAction('unpin', socket, tid, callback);
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

	if(!data || !data.title || !data.pids || !Array.isArray(data.pids)) {
		return callback(new Error('invalid data'));
	}

	topics.createTopicFromPosts(socket.uid, data.title, data.pids, callback);
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

	if(!data || !data.pid || !data.tid) {
		return callback(new Error('invalid data'));
	}

	threadTools.privileges(data.tid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}

		if(!(privileges.admin || privileges.moderator)) {
			return callback(new Error('not allowed'));
		}

		topics.movePostToTopic(data.pid, data.tid, callback);
	});
};

SocketTopics.move = function(socket, data, callback) {

	if(!data || !data.tid || !data.cid) {
		return callback(new Error('invalid data'));
	}

	threadTools.move(data.tid, data.cid, function(err) {
		if(err) {
			return callback(err);
		}

		index.server.sockets.in('topic_' + data.tid).emit('event:topic_moved', {
			tid: data.tid
		});

		callback(null);
	});
};

SocketTopics.followCheck = function(socket, tid, callback) {
	threadTools.isFollowing(tid, socket.uid, callback);
};

SocketTopics.follow = function(socket, tid, callback) {
	if(!socket.uid) {
		return callback(new Error('not-logged-in'));
	}


	threadTools.toggleFollow(tid, socket.uid, callback);
};

SocketTopics.loadMore = function(socket, data, callback) {
	if(!data || !data.tid) {
		return callback(new Error('invalid data'));
	}

	var postsPerPage = parseInt(meta.config.postsPerPage, 10);
	postsPerPage = postsPerPage ? postsPerPage : 20;

	var start = data.after,
		end = start + postsPerPage - 1;

	topics.getTopicPosts(data.tid, start, end, socket.uid, function(err, posts) {
		if(err) {
			return callback(err);
		}

		callback(err, {posts: posts});
	});
};

SocketTopics.loadPage = function(socket, data, callback) {
	if(!data || !data.tid || !data.page || parseInt(data.page < 0)) {
		return callback(new Error('invalid data'));
	}

	var postsPerPage = parseInt((meta.config.postsPerPage ? meta.config.postsPerPage : 20), 10);

	topics.getPageCount(data.tid, function(err, pageCount) {
		if(err) {
			return callback(err);
		}

		if(data.page > pageCount) {
			return callback(new Error('page doesn\'t exist'));
		}

		var start = (data.page-1) * postsPerPage,
			end = start + postsPerPage - 1;

		topics.getTopicPosts(data.tid, start, end, socket.uid, function(err, posts) {
			callback(err, {posts: posts});
		});
	});
}

SocketTopics.loadMoreRecentTopics = function(socket, data, callback) {
	if(!data || !data.term) {
		return callback(new Error('invalid data'));
	}

	var start = data.after,
		end = start + 9;

	topics.getLatestTopics(socket.uid, start, end, data.term, callback);
};

SocketTopics.loadMoreUnreadTopics = function(socket, data, callback) {
	var start = data.after,
		end = start + 9;

	topics.getUnreadTopics(socket.uid, start, end, callback);
};

SocketTopics.getPageCount = function(socket, tid, callback) {
	topics.getPageCount(tid, callback);
}

module.exports = SocketTopics;