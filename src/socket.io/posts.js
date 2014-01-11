var	posts = require('../posts'),
	meta = require('../meta'),
	topics = require('../topics'),
	favourites = require('../favourites'),
	postTools = require('../postTools'),

	SocketPosts = {};

SocketPosts.reply = function(data, callback, sessionData) {
	if (sessionData.uid < 1 && parseInt(meta.config.allowGuestPosting, 10) === 0) {
		sessionData.socket.emit('event:alert', {
			title: 'Reply Unsuccessful',
			message: 'You don&apos;t seem to be logged in, so you cannot reply.',
			type: 'danger',
			timeout: 2000
		});
		return;
	}

	topics.reply(data.topic_id, sessionData.uid, data.content, function(err, postData) {
		if(err) {
			if (err.message === 'content-too-short') {
				module.parent.exports.emitContentTooShortAlert(sessionData.socket);
			} else if (err.message === 'too-many-posts') {
				module.parent.exports.emitTooManyPostsAlert(sessionData.socket);
			} else if (err.message === 'reply-error') {
				sessionData.socket.emit('event:alert', {
					title: 'Reply Unsuccessful',
					message: 'Your reply could not be posted at this time. Please try again later.',
					type: 'warning',
					timeout: 2000
				});
			} else if (err.message === 'no-privileges') {
				sessionData.socket.emit('event:alert', {
					title: 'Unable to post',
					message: 'You do not have posting privileges in this category.',
					type: 'danger',
					timeout: 7500
				});
			}
			return;
		}

		if (postData) {

			module.parent.exports.emitTopicPostStats();

			sessionData.socket.emit('event:alert', {
				title: 'Reply Successful',
				message: 'You have successfully replied. Click here to view your reply.',
				type: 'success',
				timeout: 2000
			});
			var socketData = {
				posts: [postData]
			};
			sessionData.server.sockets.in('topic_' + postData.tid).emit('event:new_post', socketData);
			sessionData.server.sockets.in('recent_posts').emit('event:new_post', socketData);
			sessionData.server.sockets.in('user/' + postData.uid).emit('event:new_post', socketData);
			callback();
		}

	});
};

SocketPosts.favourite = function(data, sessionData) {
	favourites.favourite(data.pid, data.room_id, sessionData.uid, sessionData.socket);
};

SocketPosts.unfavourite = function(data, sessionData) {
	favourites.unfavourite(data.pid, data.room_id, sessionData.uid, sessionData.socket);
};

SocketPosts.uploadImage = function(data, callback) {
	posts.uploadPostImage(data, callback);
};

SocketPosts.uploadFile = function(data, callback) {
	posts.uploadPostFile(data, callback);
};

SocketPosts.getRawPost = function(data, callback) {
	posts.getPostField(data.pid, 'content', function(err, raw) {
		callback({
			post: raw
		});
	});
};

SocketPosts.edit = function(data, callback, sessionData) {
	if(!sessionData.uid) {
		sessionData.socket.emit('event:alert', {
			title: 'Can&apos;t edit',
			message: 'Guests can&apos;t edit posts!',
			type: 'warning',
			timeout: 2000
		});
		return;
	} else if (!data.title || data.title.length < parseInt(meta.config.minimumTitleLength, 10)) {
		topics.emitTitleTooShortAlert(sessionData.socket);
		return;
	} else if (!data.content || data.content.length < parseInt(meta.config.minimumPostLength, 10)) {
		module.parent.exports.emitContentTooShortAlert(sessionData.socket);
		return;
	}

	postTools.edit(sessionData.uid, data.pid, data.title, data.content, data.images);
	callback();
};

SocketPosts.delete = function(data, callback, sessionData) {
	postTools.delete(sessionData.uid, data.pid, function(err) {

		if(err) {
			return callback(err);
		}

		module.parent.exports.emitTopicPostStats();

		sessionData.server.sockets.in('topic_' + data.tid).emit('event:post_deleted', {
			pid: data.pid
		});
		callback(null);
	});
};

SocketPosts.restore = function(data, callback, sessionData) {
	postTools.restore(sessionData.uid, data.pid, function(err) {
		if(err) {
			return callback(err);
		}

		module.parent.exports.emitTopicPostStats();

		sessionData.server.sockets.in('topic_' + data.tid).emit('event:post_restored', {
			pid: data.pid
		});
		callback(null);
	});
};

SocketPosts.getPrivileges = function(pid, callback, sessionData) {
	postTools.privileges(pid, sessionData.uid, function(privileges) {
		privileges.pid = parseInt(pid);
		callback(privileges);
	});
};

module.exports = SocketPosts;