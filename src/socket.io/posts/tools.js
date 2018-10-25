'use strict';

var async = require('async');

var posts = require('../../posts');
var topics = require('../../topics');
var events = require('../../events');
var websockets = require('../index');
var socketTopics = require('../topics');
var privileges = require('../../privileges');
var plugins = require('../../plugins');
var social = require('../../social');
var user = require('../../user');


module.exports = function (SocketPosts) {
	SocketPosts.loadPostTools = function (socket, data, callback) {
		if (!data || !data.pid || !data.cid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.waterfall([
			function (next) {
				async.parallel({
					posts: function (next) {
						posts.getPostFields(data.pid, ['deleted', 'bookmarks', 'uid', 'ip'], next);
					},
					isAdmin: function (next) {
						user.isAdministrator(socket.uid, next);
					},
					isGlobalMod: function (next) {
						user.isGlobalModerator(socket.uid, next);
					},
					isModerator: function (next) {
						user.isModerator(socket.uid, data.cid, next);
					},
					canEdit: function (next) {
						privileges.posts.canEdit(data.pid, socket.uid, next);
					},
					canDelete: function (next) {
						privileges.posts.canDelete(data.pid, socket.uid, next);
					},
					canPurge: function (next) {
						privileges.posts.canPurge(data.pid, socket.uid, next);
					},
					canFlag: function (next) {
						privileges.posts.canFlag(data.pid, socket.uid, next);
					},
					bookmarked: function (next) {
						posts.hasBookmarked(data.pid, socket.uid, next);
					},
					tools: function (next) {
						plugins.fireHook('filter:post.tools', { pid: data.pid, uid: socket.uid, tools: [] }, next);
					},
					postSharing: function (next) {
						social.getActivePostSharing(next);
					},
					history: async.apply(posts.diffs.exists, data.pid),
				}, next);
			},
			function (results, next) {
				var posts = results.posts;
				posts.tools = results.tools.tools;
				posts.bookmarked = results.bookmarked;
				posts.selfPost = socket.uid && socket.uid === posts.uid;
				posts.display_edit_tools = results.canEdit.flag;
				posts.display_delete_tools = results.canDelete.flag;
				posts.display_purge_tools = results.canPurge;
				posts.display_flag_tools = socket.uid && !posts.selfPost && results.canFlag.flag;
				posts.display_moderator_tools = posts.display_edit_tools || posts.display_delete_tools;
				posts.display_move_tools = results.isAdmin || results.isModerator;
				posts.display_ip_ban = (results.isAdmin || results.isGlobalMod) && !posts.selfPost;
				posts.display_history = results.history;
				posts.toolsVisible = posts.tools.length || posts.display_moderator_tools;

				if (!results.isAdmin && !results.isGlobalMod && !results.isModerator) {
					posts.ip = undefined;
				}
				next(null, results);
			},
		], callback);
	};

	SocketPosts.delete = function (socket, data, callback) {
		if (!data || !data.pid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		var postData;
		async.waterfall([
			function (next) {
				posts.tools.delete(socket.uid, data.pid, next);
			},
			function (_postData, next) {
				postData = _postData;
				isMainAndLastPost(data.pid, next);
			},
			function (results, next) {
				if (results.isMain && results.isLast) {
					deleteOrRestoreTopicOf('delete', data.pid, socket, next);
				} else {
					next();
				}
			},
			function (next) {
				websockets.in('topic_' + data.tid).emit('event:post_deleted', postData);

				events.log({
					type: 'post-delete',
					uid: socket.uid,
					pid: data.pid,
					tid: postData.tid,
					ip: socket.ip,
				});

				next();
			},
		], callback);
	};

	SocketPosts.restore = function (socket, data, callback) {
		if (!data || !data.pid) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		var postData;
		async.waterfall([
			function (next) {
				posts.tools.restore(socket.uid, data.pid, next);
			},
			function (_postData, next) {
				postData = _postData;
				isMainAndLastPost(data.pid, next);
			},
			function (results, next) {
				if (results.isMain && results.isLast) {
					deleteOrRestoreTopicOf('restore', data.pid, socket, next);
				} else {
					setImmediate(next);
				}
			},
			function (next) {
				websockets.in('topic_' + data.tid).emit('event:post_restored', postData);

				events.log({
					type: 'post-restore',
					uid: socket.uid,
					pid: data.pid,
					tid: postData.tid,
					ip: socket.ip,
				});

				setImmediate(next);
			},
		], callback);
	};

	SocketPosts.deletePosts = function (socket, data, callback) {
		if (!data || !Array.isArray(data.pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.eachSeries(data.pids, function (pid, next) {
			SocketPosts.delete(socket, { pid: pid, tid: data.tid }, next);
		}, callback);
	};

	SocketPosts.purgePosts = function (socket, data, callback) {
		if (!data || !Array.isArray(data.pids)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		async.eachSeries(data.pids, function (pid, next) {
			SocketPosts.purge(socket, { pid: pid, tid: data.tid }, next);
		}, callback);
	};

	SocketPosts.purge = function (socket, data, callback) {
		if (!data || !parseInt(data.pid, 10)) {
			return callback(new Error('[[error:invalid-data]]'));
		}
		var postData;
		var topicData;
		var isMainAndLast = false;
		async.waterfall([
			function (next) {
				isMainAndLastPost(data.pid, next);
			},
			function (results, next) {
				if (results.isMain && !results.isLast) {
					return next(new Error('[[error:cant-purge-main-post]]'));
				}
				isMainAndLast = results.isMain && results.isLast;

				posts.getPostFields(data.pid, ['toPid', 'tid'], next);
			},
			function (_postData, next) {
				postData = _postData;
				postData.pid = data.pid;
				posts.tools.purge(socket.uid, data.pid, next);
			},
			function (next) {
				websockets.in('topic_' + data.tid).emit('event:post_purged', postData);
				topics.getTopicFields(data.tid, ['title', 'cid'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				events.log({
					type: 'post-purge',
					uid: socket.uid,
					pid: data.pid,
					ip: socket.ip,
					tid: postData.tid,
					title: String(topicData.title),
				}, next);
			},
			function (next) {
				if (isMainAndLast) {
					socketTopics.doTopicAction('purge', 'event:topic_purged', socket, { tids: [postData.tid], cid: topicData.cid }, next);
				} else {
					setImmediate(next);
				}
			},
		], callback);
	};

	function deleteOrRestoreTopicOf(command, pid, socket, callback) {
		async.waterfall([
			function (next) {
				posts.getTopicFields(pid, ['tid', 'cid', 'deleted'], next);
			},
			function (topic, next) {
				if (command === 'delete' && !topic.deleted) {
					socketTopics.doTopicAction('delete', 'event:topic_deleted', socket, { tids: [topic.tid], cid: topic.cid }, next);
				} else if (command === 'restore' && topic.deleted) {
					socketTopics.doTopicAction('restore', 'event:topic_restored', socket, { tids: [topic.tid], cid: topic.cid }, next);
				} else {
					setImmediate(next);
				}
			},
		], callback);
	}

	function isMainAndLastPost(pid, callback) {
		async.parallel({
			isMain: function (next) {
				posts.isMain(pid, next);
			},
			isLast: function (next) {
				posts.getTopicFields(pid, ['postcount'], function (err, topic) {
					next(err, topic ? topic.postcount === 1 : false);
				});
			},
		}, callback);
	}
};
