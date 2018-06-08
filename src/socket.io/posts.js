'use strict';

var async = require('async');

var posts = require('../posts');
var privileges = require('../privileges');
var plugins = require('../plugins');
var meta = require('../meta');
var topics = require('../topics');
var user = require('../user');
var websockets = require('./index');
var socketHelpers = require('./helpers');
var utils = require('../utils');

var apiController = require('../controllers/api');

var SocketPosts = module.exports;

require('./posts/edit')(SocketPosts);
require('./posts/move')(SocketPosts);
require('./posts/votes')(SocketPosts);
require('./posts/bookmarks')(SocketPosts);
require('./posts/tools')(SocketPosts);
require('./posts/diffs')(SocketPosts);

SocketPosts.reply = function (socket, data, callback) {
	if (!data || !data.tid || (parseInt(meta.config.minimumPostLength, 10) !== 0 && !data.content)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	data.uid = socket.uid;
	data.req = websockets.reqFromSocket(socket);
	data.timestamp = Date.now();

	async.waterfall([
		function (next) {
			meta.blacklist.test(data.req.ip, next);
		},
		function (next) {
			posts.shouldQueue(socket.uid, data, next);
		},
		function (shouldQueue, next) {
			if (shouldQueue) {
				posts.addToQueue(data, next);
			} else {
				postReply(socket, data, next);
			}
		},
	], callback);
};

function postReply(socket, data, callback) {
	async.waterfall([
		function (next) {
			topics.reply(data, next);
		},
		function (postData, next) {
			var result = {
				posts: [postData],
				'reputation:disabled': parseInt(meta.config['reputation:disabled'], 10) === 1,
				'downvote:disabled': parseInt(meta.config['downvote:disabled'], 10) === 1,
			};

			next(null, postData);

			socket.emit('event:new_post', result);

			user.updateOnlineUsers(socket.uid);

			socketHelpers.notifyNew(socket.uid, 'newPost', result);
		},
	], callback);
}

SocketPosts.getRawPost = function (socket, pid, callback) {
	async.waterfall([
		function (next) {
			privileges.posts.can('read', pid, socket.uid, next);
		},
		function (canRead, next) {
			if (!canRead) {
				return next(new Error('[[error:no-privileges]]'));
			}
			posts.getPostFields(pid, ['content', 'deleted'], next);
		},
		function (postData, next) {
			if (parseInt(postData.deleted, 10) === 1) {
				return next(new Error('[[error:no-post]]'));
			}
			next(null, postData.content);
		},
	], callback);
};

SocketPosts.getPost = function (socket, pid, callback) {
	apiController.getPostData(pid, socket.uid, callback);
};

SocketPosts.loadMoreBookmarks = function (socket, data, callback) {
	loadMorePosts('uid:' + data.uid + ':bookmarks', socket.uid, data, callback);
};

SocketPosts.loadMoreUserPosts = function (socket, data, callback) {
	loadMorePosts('uid:' + data.uid + ':posts', socket.uid, data, callback);
};

SocketPosts.loadMoreBestPosts = function (socket, data, callback) {
	loadMorePosts('uid:' + data.uid + ':posts:votes', socket.uid, data, callback);
};

SocketPosts.loadMoreUpVotedPosts = function (socket, data, callback) {
	loadMorePosts('uid:' + data.uid + ':upvote', socket.uid, data, callback);
};

SocketPosts.loadMoreDownVotedPosts = function (socket, data, callback) {
	loadMorePosts('uid:' + data.uid + ':downvote', socket.uid, data, callback);
};

function loadMorePosts(set, uid, data, callback) {
	if (!data || !utils.isNumber(data.uid) || !utils.isNumber(data.after)) {
		return callback(new Error('[[error:invalid-data]]'));
	}

	var start = Math.max(0, parseInt(data.after, 10));
	var stop = start + 9;

	posts.getPostSummariesFromSet(set, uid, start, stop, callback);
}

SocketPosts.getCategory = function (socket, pid, callback) {
	posts.getCidByPid(pid, callback);
};

SocketPosts.getPidIndex = function (socket, data, callback) {
	if (!data) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	posts.getPidIndex(data.pid, data.tid, data.topicPostSort, callback);
};

SocketPosts.getReplies = function (socket, pid, callback) {
	if (!utils.isNumber(pid)) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	var postPrivileges;
	async.waterfall([
		function (next) {
			posts.getPidsFromSet('pid:' + pid + ':replies', 0, -1, false, next);
		},
		function (pids, next) {
			async.parallel({
				posts: function (next) {
					posts.getPostsByPids(pids, socket.uid, next);
				},
				privileges: function (next) {
					privileges.posts.get(pids, socket.uid, next);
				},
			}, next);
		},
		function (results, next) {
			postPrivileges = results.privileges;

			topics.addPostData(results.posts, socket.uid, next);
		},
		function (postData, next) {
			postData.forEach(function (postData, index) {
				posts.modifyPostByPrivilege(postData, postPrivileges[index]);
			});
			postData = postData.filter(function (postData, index) {
				return postData && postPrivileges[index].read;
			});
			next(null, postData);
		},
	], callback);
};

SocketPosts.accept = function (socket, data, callback) {
	acceptOrReject(posts.submitFromQueue, socket, data, callback);
};

SocketPosts.reject = function (socket, data, callback) {
	acceptOrReject(posts.removeFromQueue, socket, data, callback);
};

SocketPosts.editQueuedContent = function (socket, data, callback) {
	if (!data || !data.id || !data.content) {
		return callback(new Error('[[error:invalid-data]]'));
	}
	async.waterfall([
		function (next) {
			posts.editQueuedContent(socket.uid, data.id, data.content, next);
		},
		function (next) {
			plugins.fireHook('filter:parse.post', { postData: data }, next);
		},
	], callback);
};

function acceptOrReject(method, socket, data, callback) {
	async.waterfall([
		function (next) {
			posts.canEditQueue(socket.uid, data.id, next);
		},
		function (canEditQueue, next) {
			if (!canEditQueue) {
				return callback(new Error('[[error:no-privileges]]'));
			}

			method(data.id, next);
		},
	], callback);
}
