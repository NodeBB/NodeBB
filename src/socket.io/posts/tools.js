'use strict';

var async = require('async');
var winston = require('winston');
var validator = require('validator');

var posts = require('../../posts');
var topics = require('../../topics');
var events = require('../../events');
var websockets = require('../index');
var socketTopics = require('../topics');
var privileges = require('../../privileges');
var plugins = require('../../plugins');
var social = require('../../social');
var favourites = require('../../favourites');

module.exports = function(SocketPosts) {

	SocketPosts.loadPostTools = function(socket, data, callback) {
		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.parallel({
			posts: function(next) {
				posts.getPostFields(data.pid, ['deleted', 'reputation', 'uid'], next);
			},
			isAdminOrMod: function(next) {
				privileges.categories.isAdminOrMod(data.cid, socket.uid, next);
			},
			favourited: function(next) {
				favourites.getFavouritesByPostIDs([data.pid], socket.uid, next);
			},
			tools: function(next) {
				plugins.fireHook('filter:post.tools', {pid: data.pid, uid: socket.uid, tools: []}, next);
			},
			postSharing: function(next) {
				social.getActivePostSharing(next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			results.posts.tools = results.tools.tools;
			results.posts.deleted = parseInt(results.posts.deleted, 10) === 1;
			results.posts.favourited = results.favourited[0];
			results.posts.selfPost = socket.uid && socket.uid === parseInt(results.posts.uid, 10);
			results.posts.display_moderator_tools = results.isAdminOrMod || results.posts.selfPost;
			results.posts.display_move_tools = results.isAdminOrMod;
			callback(null, results);
		});
	};

	SocketPosts.delete = function(socket, data, callback) {
		doPostAction('delete', 'event:post_deleted', socket, data, callback);
	};

	SocketPosts.restore = function(socket, data, callback) {
		doPostAction('restore', 'event:post_restored', socket, data, callback);
	};

	SocketPosts.deletePosts = function(socket, data, callback) {
		if (!data || !Array.isArray(data.pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.each(data.pids, function(pid, next) {
			SocketPosts.delete(socket, {pid: pid, tid: data.tid}, next);
		}, callback);
	};

	SocketPosts.purgePosts = function(socket, data, callback) {
		if (!data || !Array.isArray(data.pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.each(data.pids, function(pid, next) {
			SocketPosts.purge(socket, {pid: pid, tid: data.tid}, next);
		}, callback);
	};

	function doPostAction(command, eventName, socket, data, callback) {
		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		posts.tools[command](socket.uid, data.pid, function(err, postData) {
			if (err) {
				return callback(err);
			}

			websockets.in('topic_' + data.tid).emit(eventName, postData);

			events.log({
				type: 'post-' + command,
				uid: socket.uid,
				pid: data.pid,
				ip: socket.ip
			});

			callback();
		});
	}

	SocketPosts.purge = function(socket, data, callback) {
		function purgePost() {
			posts.tools.purge(socket.uid, data.pid, function(err) {
				if (err) {
					return callback(err);
				}

				websockets.in('topic_' + data.tid).emit('event:post_purged', data.pid);

				topics.getTopicField(data.tid, 'title', function(err, title) {
					if (err) {
						return winston.error(err);
					}
					events.log({
						type: 'post-purge',
						uid: socket.uid,
						pid: data.pid,
						ip: socket.ip,
						title: validator.escape(String(title))
					});
				});

				callback();
			});
		}

		if (!data || !parseInt(data.pid, 10)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		isMainAndLastPost(data.pid, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (!results.isMain) {
				return purgePost();
			}

			if (!results.isLast) {
				return callback(new Error('[[error:cant-purge-main-post]]'));
			}

			posts.getTopicFields(data.pid, ['tid', 'cid'], function(err, topic) {
				if (err) {
					return callback(err);
				}
				socketTopics.doTopicAction('delete', 'event:topic_deleted', socket, {tids: [topic.tid], cid: topic.cid}, callback);
			});
		});
	};

	function isMainAndLastPost(pid, callback) {
		async.parallel({
			isMain: function(next) {
				posts.isMain(pid, next);
			},
			isLast: function(next) {
				posts.getTopicFields(pid, ['postcount'], function(err, topic) {
					next(err, topic ? parseInt(topic.postcount, 10) === 1 : false);
				});
			}
		}, callback);
	}

};