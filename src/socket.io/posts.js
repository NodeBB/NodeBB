"use strict";

var	async = require('async'),
	nconf = require('nconf'),

	db = require('../database'),
	posts = require('../posts'),
	privileges = require('../privileges'),
	meta = require('../meta'),
	topics = require('../topics'),
	favourites = require('../favourites'),
	postTools = require('../postTools'),
	notifications = require('../notifications'),
	groups = require('../groups'),
	user = require('../user'),
	websockets = require('./index'),

	SocketPosts = {};


SocketPosts.reply = function(socket, data, callback) {

	if (!socket.uid && !parseInt(meta.config.allowGuestPosting, 10)) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	if(!data || !data.tid || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	data.uid = socket.uid;
	data.req = websockets.reqFromSocket(socket);

	topics.reply(data, function(err, postData) {
		if(err) {
			return callback(err);
		}

		if (postData) {
			websockets.server.sockets.emit('event:new_post', {
				posts: [postData]
			});

			module.parent.exports.emitTopicPostStats();

			callback();
		}
	});
};

SocketPosts.upvote = function(socket, data, callback) {
	favouriteCommand('upvote', 'voted', socket, data, callback);
	sendNotificationToPostOwner(data, socket.uid, 'notifications:upvoted_your_post');
};

SocketPosts.downvote = function(socket, data, callback) {
	favouriteCommand('downvote', 'voted', socket, data, callback);
};

SocketPosts.unvote = function(socket, data, callback) {
	favouriteCommand('unvote', 'voted', socket, data, callback);
};

SocketPosts.favourite = function(socket, data, callback) {
	favouriteCommand('favourite', 'favourited', socket, data, callback);
	sendNotificationToPostOwner(data, socket.uid, 'notifications:favourited_your_post');
};

SocketPosts.unfavourite = function(socket, data, callback) {
	favouriteCommand('unfavourite', 'favourited', socket, data, callback);
};

function favouriteCommand(command, eventName, socket, data, callback) {

	if(data && data.pid && data.room_id) {
		favourites[command](data.pid, socket.uid, function(err, result) {
			if (err) {
				return callback(err);
			}

			socket.emit('posts.' + command, result);

			if(data.room_id && result && eventName) {
				websockets.in(data.room_id).emit('event:' + eventName, result);
			}
			callback();
		});
	}
}

function sendNotificationToPostOwner(data, uid, notification) {
	if(data && data.pid && uid) {
		posts.getPostFields(data.pid, ['tid', 'uid'], function(err, postData) {
			if (err) {
				return;
			}

			if (uid === parseInt(postData.uid, 10)) {
				return;
			}

			async.parallel({
				username: function(next) {
					user.getUserField(uid, 'username', next);
				},
				slug: function(next) {
					topics.getTopicField(postData.tid, 'slug', next);
				}
			}, function(err, results) {
				if (err) {
					return;
				}

				notifications.create({
					text: '[[' + notification + ', ' + results.username + ']]',
					path: nconf.get('relative_path') + '/topic/' + results.slug + '#' + data.pid,
					uniqueId: 'post:' + data.pid,
					from: uid
				}, function(nid) {
					notifications.push(nid, [postData.uid]);
				});
			});
		});
	}
}

SocketPosts.getRawPost = function(socket, pid, callback) {
	async.waterfall([
		function(next) {
			privileges.posts.canRead(pid, socket.uid, next);
		},
		function(canRead, next) {
			if (!canRead) {
				return next(new Error('[[error:no-privileges]]'));
			}
			posts.getPostFields(pid, ['content', 'deleted'], next);
		}
	], function(err, post) {
		if(err) {
			return callback(err);
		}

		if(parseInt(post.deleted, 10) === 1) {
			return callback(new Error('[[error:no-post]]'));
		}

		callback(null, post.content);
	});
};

SocketPosts.edit = function(socket, data, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	} else if(!data || !data.pid || !data.title || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	} else if (!data.title || data.title.length < parseInt(meta.config.minimumTitleLength, 10)) {
		return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
	} else if (!data.content || data.content.length < parseInt(meta.config.minimumPostLength, 10)) {
		return callback(new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]'));
	}

	postTools.edit(socket.uid, data.pid, data.title, data.content, {topic_thumb: data.topic_thumb}, function(err, results) {
		if(err) {
			return callback(err);
		}

		websockets.server.sockets.in('topic_' + results.topic.tid).emit('event:post_edited', {
			pid: data.pid,
			title: results.topic.title,
			isMainPost: results.topic.isMainPost,
			content: results.content
		});

		callback();
	});
};

SocketPosts.delete = function(socket, data, callback) {
	deleteOrRestore('delete', socket, data, callback);
};

SocketPosts.restore = function(socket, data, callback) {
	deleteOrRestore('restore', socket, data, callback);
};

function deleteOrRestore(command, socket, data, callback) {
	if(!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	postTools[command](socket.uid, data.pid, function(err) {
		if(err) {
			return callback(err);
		}

		module.parent.exports.emitTopicPostStats();

		var eventName = command === 'restore' ? 'event:post_restored' : 'event:post_deleted';
		websockets.server.sockets.in('topic_' + data.tid).emit(eventName, {
			pid: data.pid
		});

		callback();
	});
}

SocketPosts.getPrivileges = function(socket, pid, callback) {
	privileges.posts.get(pid, socket.uid, function(err, privileges) {
		if(err) {
			return callback(err);
		}
		privileges.pid = parseInt(pid, 10);
		callback(null, privileges);
	});
};

SocketPosts.getFavouritedUsers = function(socket, pid, callback) {

	favourites.getFavouritedUidsByPids([pid], function(err, data) {

		if(err) {
			return callback(err);
		}

		if(!Array.isArray(data) || !data.length) {
			callback(null, "");
		}

		var max = 5; //hardcoded
		var finalText = "";

		var pid_uids = data[0];
		var rest_amount = 0;

		if (pid_uids.length > max) {
			rest_amount = pid_uids.length - max;
			pid_uids = pid_uids.slice(0, max);
		}

		user.getUsernamesByUids(pid_uids, function(err, usernames) {
			if(err) {
				return callback(err);
			}

			finalText = usernames.join(', ') + (rest_amount > 0 ?
				(" and " + rest_amount + (rest_amount > 1 ? " others" : " other")) : "");
			callback(null, finalText);
		});
	});
};

SocketPosts.getPidPage = function(socket, pid, callback) {
	posts.getPidPage(pid, socket.uid, callback);
};

SocketPosts.getPidIndex = function(socket, pid, callback) {
	posts.getPidIndex(pid, callback);
};

SocketPosts.flag = function(socket, pid, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	var message = '',
		path = '',
		post;

	async.waterfall([
		function(next) {
			user.getUserField(socket.uid, 'username', next);
		},
		function(username, next) {
			message = '[[notifications:user_flagged_post, ' + username + ']]';
			posts.getPostFields(pid, ['tid', 'uid'], next);
		},
		function(postData, next) {
			post = postData;
			topics.getTopicField(postData.tid, 'slug', next);
		},
		function(topicSlug, next) {
			path = nconf.get('relative_path') + '/topic/' + topicSlug + '#' + pid;
			groups.get('administrators', {}, next);
		},
		function(adminGroup, next) {
			notifications.create({
				text: message,
				path: path,
				uniqueId: 'post_flag:' + pid,
				from: socket.uid
			}, function(nid) {
				notifications.push(nid, adminGroup.members, function() {
					next();
				});
			});
		},
		function(next) {
			if (!parseInt(post.uid, 10)) {
				return next();
			}

			db.setAdd('uid:' + post.uid + ':flagged_by', socket.uid, function(err) {
				if (err) {
					return next(err);
				}
				db.setCount('uid:' + post.uid + ':flagged_by', function(err, count) {
					if (err) {
						return next(err);
					}

					if (count >= (meta.config.flagsForBan || 3) && parseInt(meta.config.flagsForBan, 10) !== 0) {
						var adminUser = require('./admin/user');
						adminUser.banUser(post.uid, next);
						return;
					}
					next();
				});
			});
		}
	], callback);
};

SocketPosts.loadMoreFavourites = function(socket, data, callback) {
	if(!data || !data.after) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	posts.getFavourites(socket.uid, start, end, callback);
};

SocketPosts.loadMoreUserPosts = function(socket, data, callback) {
	if(!data || !data.after || !data.uid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = parseInt(data.after, 10),
		end = start + 9;

	posts.getPostsByUid(socket.uid, data.uid, start, end, callback);
};


SocketPosts.getRecentPosts = function(socket, data, callback) {
	if(!data || !data.count) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	posts.getRecentPosts(socket.uid, 0, data.count - 1, data.term, callback);
};

SocketPosts.getCategory = function(socket, pid, callback) {
	posts.getCidByPid(pid, callback);
};

module.exports = SocketPosts;
