'use strict';

var async = require('async');

var topics = require('../../topics');
var events = require('../../events');
var privileges = require('../../privileges');
var plugins = require('../../plugins');
var socketHelpers = require('../helpers');

module.exports = function (SocketTopics) {
	SocketTopics.loadTopicTools = function (socket, data, callback) {
		if (!socket.uid) {
			return callback(new Error('[[error:no-privileges]]'));
		}
		if (!data) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		async.waterfall([
			function (next) {
				async.parallel({
					topic: function (next) {
						topics.getTopicData(data.tid, next);
					},
					privileges: function (next) {
						privileges.topics.get(data.tid, socket.uid, next);
					},
				}, next);
			},
			function (results, next) {
				if (!results.topic) {
					return next(new Error('[[error:no-topic]]'));
				}

				results.topic.privileges = results.privileges;
				plugins.fireHook('filter:topic.thread_tools', { topic: results.topic, uid: socket.uid, tools: [] }, next);
			},
			function (data, next) {
				data.topic.thread_tools = data.tools;
				next(null, data.topic);
			},
		], callback);
	};

	SocketTopics.delete = function (socket, data, callback) {
		SocketTopics.doTopicAction('delete', 'event:topic_deleted', socket, data, callback);
	};

	SocketTopics.restore = function (socket, data, callback) {
		SocketTopics.doTopicAction('restore', 'event:topic_restored', socket, data, callback);
	};

	SocketTopics.purge = function (socket, data, callback) {
		SocketTopics.doTopicAction('purge', 'event:topic_purged', socket, data, callback);
	};

	SocketTopics.lock = function (socket, data, callback) {
		SocketTopics.doTopicAction('lock', 'event:topic_locked', socket, data, callback);
	};

	SocketTopics.unlock = function (socket, data, callback) {
		SocketTopics.doTopicAction('unlock', 'event:topic_unlocked', socket, data, callback);
	};

	SocketTopics.pin = function (socket, data, callback) {
		SocketTopics.doTopicAction('pin', 'event:topic_pinned', socket, data, callback);
	};

	SocketTopics.unpin = function (socket, data, callback) {
		SocketTopics.doTopicAction('unpin', 'event:topic_unpinned', socket, data, callback);
	};

	SocketTopics.doTopicAction = function (action, event, socket, data, callback) {
		callback = callback || function () {};
		if (!socket.uid) {
			return callback(new Error('[[error:no-privileges]]'));
		}

		if (!data || !Array.isArray(data.tids) || !data.cid) {
			return callback(new Error('[[error:invalid-tid]]'));
		}

		if (typeof topics.tools[action] !== 'function') {
			return callback();
		}

		async.each(data.tids, function (tid, next) {
			var title;
			async.waterfall([
				function (next) {
					topics.getTopicField(tid, 'title', next);
				},
				function (_title, next) {
					title = _title;
					topics.tools[action](tid, socket.uid, next);
				},
				function (data, next) {
					socketHelpers.emitToTopicAndCategory(event, data);
					logTopicAction(action, socket, tid, title, next);
				},
			], next);
		}, callback);
	};

	function logTopicAction(action, socket, tid, title, callback) {
		var actionsToLog = ['delete', 'restore', 'purge'];
		if (!actionsToLog.includes(action)) {
			return setImmediate(callback);
		}
		events.log({
			type: 'topic-' + action,
			uid: socket.uid,
			ip: socket.ip,
			tid: tid,
			title: String(title),
		}, callback);
	}

	SocketTopics.orderPinnedTopics = function (socket, data, callback) {
		if (!Array.isArray(data)) {
			return callback(new Error('[[error:invalid-data]]'));
		}

		topics.tools.orderPinnedTopics(socket.uid, data, callback);
	};
};
