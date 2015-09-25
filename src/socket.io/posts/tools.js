'use strict';

var async = require('async');

var posts = require('../../posts');
var events = require('../../events');
var websockets = require('../index');
var socketTopics = require('../topics');


module.exports = function(SocketPosts) {

	SocketPosts.delete = function(socket, data, callback) {
		doPostAction('delete', 'event:post_deleted', socket, data, callback);
	};

	SocketPosts.restore = function(socket, data, callback) {
		doPostAction('restore', 'event:post_restored', socket, data, callback);
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

				events.log({
					type: 'post-purge',
					uid: socket.uid,
					pid: data.pid,
					ip: socket.ip
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