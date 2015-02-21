"use strict";

var	async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	db = require('../database'),
	posts = require('../posts'),
	plugins = require('../plugins'),
	privileges = require('../privileges'),
	meta = require('../meta'),
	topics = require('../topics'),
	favourites = require('../favourites'),
	postTools = require('../postTools'),
	notifications = require('../notifications'),
	groups = require('../groups'),
	user = require('../user'),
	websockets = require('./index'),
	events = require('../events'),
	utils = require('../../public/src/utils'),

	SocketPosts = {};


SocketPosts.reply = function(socket, data, callback) {
	if(!data || !data.tid || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	data.uid = socket.uid;
	data.req = websockets.reqFromSocket(socket);

	topics.reply(data, function(err, postData) {
		if (err) {
			return callback(err);
		}

		var result = {
			posts: [postData],
			privileges: {
				'topics:reply': true
			},
			'reputation:disabled': parseInt(meta.config['reputation:disabled'], 10) === 1,
			'downvote:disabled': parseInt(meta.config['downvote:disabled'], 10) === 1,
		};

		callback();

		socket.emit('event:new_post', result);

		SocketPosts.notifyOnlineUsers(socket.uid, result);
	});
};

SocketPosts.notifyOnlineUsers = function(uid, result) {
	var cid = result.posts[0].topic.cid;
	async.waterfall([
		function(next) {
			user.getUidsFromSet('users:online', 0, -1, next);
		},
		function(uids, next) {
			privileges.categories.filterUids('read', cid, uids, next);
		},
		function(uids, next) {
			plugins.fireHook('filter:sockets.sendNewPostToUids', {uidsTo: uids, uidFrom: uid, type: 'newPost'}, next);
		}
	], function(err, data) {
		if (err) {
			return winston.error(err.stack);
		}

		var uids = data.uidsTo;

		for(var i=0; i<uids.length; ++i) {
			if (parseInt(uids[i], 10) !== uid) {
				websockets.in('uid_' + uids[i]).emit('event:new_post', result);
			}
		}
	});
};

SocketPosts.getVoters = function(socket, data, callback) {
	if (!data || !data.pid || !data.cid) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var pid = data.pid,
		cid = data.cid;

	async.parallel({
		isAdmin: function(next) {
			user.isAdministrator(socket.uid, next);
		},
		isModerator: function(next) {
			user.isModerator(socket.uid, cid, next);
		}
	}, function(err, tests) {
		if (err) {
			return callback(err);
		}

		if (tests.isAdmin || tests.isModerator) {
			getVoters(pid, callback);
		}
	});
};

function getVoters(pid, callback) {
	async.parallel({
		upvoteUids: function(next) {
			db.getSetMembers('pid:' + pid + ':upvote', next);
		},
		downvoteUids: function(next) {
			db.getSetMembers('pid:' + pid + ':downvote', next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}
		async.parallel({
			upvoters: function(next) {
				user.getMultipleUserFields(results.upvoteUids, ['username', 'userslug', 'picture'], next);
			},
			upvoteCount: function(next) {
				next(null, results.upvoteUids.length);
			},
			downvoters: function(next) {
				user.getMultipleUserFields(results.downvoteUids, ['username', 'userslug', 'picture'], next);
			},
			downvoteCount: function(next) {
				next(null, results.downvoteUids.length);
			}
		}, callback);
	});
}

SocketPosts.upvote = function(socket, data, callback) {
	favouriteCommand(socket, 'upvote', 'voted', 'notifications:upvoted_your_post_in', data, callback);
};

SocketPosts.downvote = function(socket, data, callback) {
	favouriteCommand(socket, 'downvote', 'voted', '', data, callback);
};

SocketPosts.unvote = function(socket, data, callback) {
	favouriteCommand(socket, 'unvote', 'voted', '', data, callback);
};

SocketPosts.favourite = function(socket, data, callback) {
	favouriteCommand(socket, 'favourite', 'favourited', 'notifications:favourited_your_post_in', data, callback);
};

SocketPosts.unfavourite = function(socket, data, callback) {
	favouriteCommand(socket, 'unfavourite', 'favourited', '', data, callback);
};

function favouriteCommand(socket, command, eventName, notification, data, callback) {
	if(!data || !data.pid || !data.room_id) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.parallel({
		exists: function(next) {
			posts.exists(data.pid, next);
		},
		deleted: function(next) {
			posts.getPostField(data.pid, 'deleted', next);
		}
	}, function(err, results) {
		if (err || !results.exists) {
			return callback(err || new Error('[[error:invalid-pid]]'));
		}

		if (parseInt(results.deleted, 10) === 1) {
			return callback(new Error('[[error:post-deleted]]'));
		}

		/*
		hooks:
			filter.post.upvote
			filter.post.downvote
			filter.post.unvote
			filter.post.favourite
			filter.post.unfavourite
		 */
		plugins.fireHook('filter:post.' + command, {data: data, uid: socket.uid}, function(err, filteredData) {
			if (err) {
				return callback(err);
			}

			executeFavouriteCommand(socket, command, eventName, notification, filteredData.data, callback);
		});
	});
}

function executeFavouriteCommand(socket, command, eventName, notification, data, callback) {
	favourites[command](data.pid, socket.uid, function(err, result) {
		if (err) {
			return callback(err);
		}

		socket.emit('posts.' + command, result);

		if (result && eventName) {
			websockets.in(data.room_id).emit('event:' + eventName, result);
		}

		if (notification) {
			SocketPosts.sendNotificationToPostOwner(data.pid, socket.uid, notification);
		}
		callback();
	});
}

SocketPosts.sendNotificationToPostOwner = function(pid, fromuid, notification) {
	if(!pid || !fromuid || !notification) {
		return;
	}
	posts.getPostFields(pid, ['tid', 'uid', 'content'], function(err, postData) {
		if (err) {
			return;
		}

		if (!postData.uid || fromuid === parseInt(postData.uid, 10)) {
			return;
		}

		async.parallel({
			username: async.apply(user.getUserField, fromuid, 'username'),
			topicTitle: async.apply(topics.getTopicField, postData.tid, 'title'),
			postObj: async.apply(postTools.parsePost, postData, postData.uid)
		}, function(err, results) {
			if (err) {
				return;
			}

			notifications.create({
				bodyShort: '[[' + notification + ', ' + results.username + ', ' + results.topicTitle + ']]',
				bodyLong: results.postObj.content,
				pid: pid,
				nid: 'post:' + pid + ':uid:' + fromuid,
				from: fromuid
			}, function(err, notification) {
				if (!err && notification) {
					notifications.push(notification, [postData.uid]);
				}
			});
		});
	});
};

SocketPosts.getRawPost = function(socket, pid, callback) {
	async.waterfall([
		function(next) {
			privileges.posts.can('read', pid, socket.uid, next);
		},
		function(canRead, next) {
			if (!canRead) {
				return next(new Error('[[error:no-privileges]]'));
			}
			posts.getPostFields(pid, ['content', 'deleted'], next);
		},
		function(postData, next) {
			if (parseInt(postData.deleted, 10) === 1) {
				return next(new Error('[[error:no-post]]'));
			}
			next(null, postData.content);
		}
	], callback);
};

SocketPosts.edit = function(socket, data, callback) {
	if(!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	} else if(!data || !data.pid || !data.title || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	} else if (!data.title || data.title.length < parseInt(meta.config.minimumTitleLength, 10)) {
		return callback(new Error('[[error:title-too-short, ' + meta.config.minimumTitleLength + ']]'));
	} else if (data.title.length > parseInt(meta.config.maximumTitleLength, 10)) {
		return callback(new Error('[[error:title-too-long, ' + meta.config.maximumTitleLength + ']]'));
	} else if (!data.content || data.content.length < parseInt(meta.config.minimumPostLength, 10)) {
		return callback(new Error('[[error:content-too-short, ' + meta.config.minimumPostLength + ']]'));
	} else if (data.content.length > parseInt(meta.config.maximumPostLength, 10)) {
		return callback(new Error('[[error:content-too-long, ' + meta.config.maximumPostLength + ']]'));
	}

	// uid, pid, title, content, options
	postTools.edit({
		uid: socket.uid,
		handle: data.handle,
		pid: data.pid,
		title: data.title,
		content: data.content,
		options: {
			topic_thumb: data.topic_thumb,
			tags: data.tags
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		websockets.in('topic_' + results.topic.tid).emit('event:post_edited', {
			pid: data.pid,
			handle: data.handle,
			title: results.topic.title,
			isMainPost: results.topic.isMainPost,
			tags: results.topic.tags,
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
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	postTools[command](socket.uid, data.pid, function(err, postData) {
		if (err) {
			return callback(err);
		}

		var eventName = command === 'delete' ? 'event:post_deleted' : 'event:post_restored';
		websockets.in('topic_' + data.tid).emit(eventName, postData);

		events.log({
			type: command === 'delete' ? 'post-delete' : 'post-restore',
			uid: socket.uid,
			pid: data.pid,
			ip: socket.ip
		});

		callback();
	});
}

SocketPosts.purge = function(socket, data, callback) {
	if(!data || !parseInt(data.pid, 10)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	postTools.purge(socket.uid, data.pid, function(err) {
		if(err) {
			return callback(err);
		}

		websockets.in('topic_' + data.tid).emit('event:post_purged', data.pid);

		events.log({
			type: 'post-purge',
			uid: socket.uid,
			pid: data.pid,
			ip: socket.ip
		});

		callback();
	});
};

SocketPosts.getPrivileges = function(socket, pids, callback) {
	privileges.posts.get(pids, socket.uid, function(err, privileges) {
		if (err) {
			return callback(err);
		}
		if (!Array.isArray(privileges) || !privileges.length) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		callback(null, privileges);
	});
};

SocketPosts.getUpvoters = function(socket, pids, callback) {
	if (!Array.isArray(pids)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	favourites.getUpvotedUidsByPids(pids, function(err, data) {
		if (err || !Array.isArray(data) || !data.length) {
			return callback(err, []);
		}

		async.map(data, function(uids, next)  {
			var otherCount = 0;
			if (uids.length > 6) {
				otherCount = uids.length - 5;
				uids = uids.slice(0, 5);
			}
			user.getUsernamesByUids(uids, function(err, usernames) {
				next(err, {
					otherCount: otherCount,
					usernames: usernames
				});
			});
		}, callback);
	});
};

SocketPosts.flag = function(socket, pid, callback) {
	if (!socket.uid) {
		return callback(new Error('[[error:not-logged-in]]'));
	}

	var message = '',
		userName = '',
		post;

	async.waterfall([
		function(next) {
			user.getUserFields(socket.uid, ['username', 'reputation'], next);
		},
		function(userData, next) {
			if (parseInt(userData.reputation, 10) < parseInt(meta.config['privileges:flag'] || 1, 10)) {
				return next(new Error('[[error:not-enough-reputation-to-flag]]'));
			}
			userName = userData.username;
			posts.getPostFields(pid, ['pid', 'tid', 'uid', 'content', 'deleted'], next);
		},
		function(postData, next) {
			if (parseInt(postData.deleted, 10) === 1) {
				return next(new Error('[[error:post-deleted]]'));
			}
			post = postData;
			posts.flag(post, socket.uid, next);
		},
		function(next) {
			topics.getTopicFields(post.tid, ['title', 'cid'], next);
		},
		function(topic, next) {
			post.topic = topic;
			message = '[[notifications:user_flagged_post_in, ' + userName + ', ' + topic.title + ']]';
			postTools.parsePost(post, socket.uid, next);
		},
		function(post, next) {
			async.parallel({
				admins: function(next) {
					groups.getMembers('administrators', 0, -1, next);
				},
				moderators: function(next) {
					groups.getMembers('cid:' + post.topic.cid + ':privileges:mods', 0, -1, next);
				}
			}, next);
		},
		function(results, next) {
			notifications.create({
				bodyShort: message,
				bodyLong: post.content,
				pid: pid,
				nid: 'post_flag:' + pid + ':uid:' + socket.uid,
				from: socket.uid
			}, function(err, notification) {
				if (err || !notification) {
					return next(err);
				}
				notifications.push(notification, results.admins.concat(results.moderators), next);
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

	posts.getPostsFromSet('uid:' + socket.uid + ':favourites', socket.uid, start, end, callback);
};

SocketPosts.loadMoreUserPosts = function(socket, data, callback) {
	if(!data || !data.uid || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = Math.max(0, parseInt(data.after, 10)),
		end = start + 9;

	posts.getPostsFromSet('uid:' + data.uid + ':posts', socket.uid, start, end, callback);
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

SocketPosts.getPidIndex = function(socket, pid, callback) {
	posts.getPidIndex(pid, socket.uid, callback);
};

module.exports = SocketPosts;
