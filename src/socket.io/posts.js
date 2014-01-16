var	posts = require('../posts'),
	meta = require('../meta'),
	topics = require('../topics'),
	favourites = require('../favourites'),
	postTools = require('../postTools'),

	SocketPosts = {};

SocketPosts.reply = function(socket, data, callback) {
	if (socket.uid < 1 && parseInt(meta.config.allowGuestPosting, 10) === 0) {
		socket.emit('event:alert', {
			title: 'Reply Unsuccessful',
			message: 'You don&apos;t seem to be logged in, so you cannot reply.',
			type: 'danger',
			timeout: 2000
		});
		return;
	}

	topics.reply(data.topic_id, socket.uid, data.content, function(err, postData) {
		if(err) {
			if (err.message === 'content-too-short') {
				module.parent.exports.emitContentTooShortAlert(socket);
			} else if (err.message === 'too-many-posts') {
				module.parent.exports.emitTooManyPostsAlert(socket);
			} else if (err.message === 'reply-error') {
				socket.emit('event:alert', {
					title: 'Reply Unsuccessful',
					message: 'Your reply could not be posted at this time. Please try again later.',
					type: 'warning',
					timeout: 2000
				});
			} else if (err.message === 'no-privileges') {
				socket.emit('event:alert', {
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

			socket.emit('event:alert', {
				title: 'Reply Successful',
				message: 'You have successfully replied. Click here to view your reply.',
				type: 'success',
				timeout: 2000
			});
			var socketData = {
				posts: [postData]
			};
			socket.server.sockets.in('topic_' + postData.tid).emit('event:new_post', socketData);
			socket.server.sockets.in('recent_posts').emit('event:new_post', socketData);
			socket.server.sockets.in('user/' + postData.uid).emit('event:new_post', socketData);
			callback();
		}

	});
};

SocketPosts.favourite = function(socket, data) {
	favourites.favourite(data.pid, data.room_id, socket.uid, socket);
};

SocketPosts.unfavourite = function(socket, data) {
	favourites.unfavourite(data.pid, data.room_id, socket.uid, socket);
};

SocketPosts.uploadImage = function(socket, data, callback) {
	posts.uploadPostImage(data, callback);
};

SocketPosts.uploadFile = function(socket, data, callback) {
	posts.uploadPostFile(data, callback);
};

SocketPosts.getRawPost = function(socket, data, callback) {
	posts.getPostField(data.pid, 'content', function(err, raw) {
		callback({
			post: raw
		});
	});
};

SocketPosts.edit = function(socket, data, callback) {
	if(!socket.uid) {
		socket.emit('event:alert', {
			title: 'Can&apos;t edit',
			message: 'Guests can&apos;t edit posts!',
			type: 'warning',
			timeout: 2000
		});
		return;
	} else if (!data.title || data.title.length < parseInt(meta.config.minimumTitleLength, 10)) {
		topics.emitTitleTooShortAlert(socket);
		return;
	} else if (!data.content || data.content.length < parseInt(meta.config.minimumPostLength, 10)) {
		module.parent.exports.emitContentTooShortAlert(socket);
		return;
	}

	postTools.edit(socket.uid, data.pid, data.title, data.content, data.images);
	callback();
};

SocketPosts.delete = function(socket, data, callback) {
	postTools.delete(socket.uid, data.pid, function(err) {

		if(err) {
			return callback(err);
		}

		module.parent.exports.emitTopicPostStats();

		socket.server.sockets.in('topic_' + data.tid).emit('event:post_deleted', {
			pid: data.pid
		});
		callback(null);
	});
};

SocketPosts.restore = function(socket, data, callback) {
	postTools.restore(socket.uid, data.pid, function(err) {
		if(err) {
			return callback(err);
		}

		module.parent.exports.emitTopicPostStats();

		socket.server.sockets.in('topic_' + data.tid).emit('event:post_restored', {
			pid: data.pid
		});
		callback(null);
	});
};

SocketPosts.getPrivileges = function(socket, pid, callback) {
	postTools.privileges(pid, socket.uid, function(privileges) {
		privileges.pid = parseInt(pid);
		callback(privileges);
	});
};

module.exports = SocketPosts;