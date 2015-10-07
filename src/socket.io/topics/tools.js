'use strict';

var async = require('async');
var topics = require('../../topics');
var events = require('../../events');
var socketHelpers = require('../helpers');

module.exports = function(SocketTopics) {


	SocketTopics.delete = function(socket, data, callback) {
		SocketTopics.doTopicAction('delete', 'event:topic_deleted', socket, data, callback);
	};

	SocketTopics.restore = function(socket, data, callback) {
		SocketTopics.doTopicAction('restore', 'event:topic_restored', socket, data, callback);
	};

	SocketTopics.purge = function(socket, data, callback) {
		SocketTopics.doTopicAction('purge', 'event:topic_purged', socket, data, callback);
	};

	SocketTopics.lock = function(socket, data, callback) {
		SocketTopics.doTopicAction('lock', 'event:topic_locked', socket, data, callback);
	};

	SocketTopics.unlock = function(socket, data, callback) {
		SocketTopics.doTopicAction('unlock', 'event:topic_unlocked', socket, data, callback);
	};

	SocketTopics.pin = function(socket, data, callback) {
		SocketTopics.doTopicAction('pin', 'event:topic_pinned', socket, data, callback);
	};

	SocketTopics.unpin = function(socket, data, callback) {
		SocketTopics.doTopicAction('unpin', 'event:topic_unpinned', socket, data, callback);
	};

	SocketTopics.doTopicAction = function(action, event, socket, data, callback) {
		callback = callback || function() {};
		if (!socket.uid) {
			return;
		}

		if (!data || !Array.isArray(data.tids) || !data.cid) {
			return callback(new Error('[[error:invalid-tid]]'));
		}

		if (typeof topics.tools[action] !== 'function') {
			return callback();
		}

		async.each(data.tids, function(tid, next) {
			topics.tools[action](tid, socket.uid, function(err, data) {
				if (err) {
					return next(err);
				}

				socketHelpers.emitToTopicAndCategory(event, data);

				if (action === 'delete' || action === 'restore' || action === 'purge') {
					events.log({
						type: 'topic-' + action,
						uid: socket.uid,
						ip: socket.ip,
						tid: tid
					});
				}

				next();
			});
		}, callback);
	};

};