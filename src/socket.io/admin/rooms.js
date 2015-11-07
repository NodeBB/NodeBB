'use strict';


var os = require('os');
var nconf = require('nconf');
var winston = require('winston');
var validator = require('validator');
var topics = require('../../topics');
var pubsub = require('../../pubsub');

var SocketRooms = {};

var stats = {};

pubsub.on('sync:stats:start', function() {
	getLocalStats(function(err, stats) {
		if (err) {
			return winston.error(err);
		}
		pubsub.publish('sync:stats:end', {stats: stats, id: os.hostname() + ':' + nconf.get('port')});
	});
});

pubsub.on('sync:stats:end', function(data) {
	stats[data.id] = data.stats;
});

SocketRooms.getAll = function(socket, data, callback) {
	pubsub.publish('sync:stats:start');
	var totals = {
		onlineGuestCount: 0,
		onlineRegisteredCount: 0,
		socketCount: 0,
		users: {
			categories: 0,
			recent: 0,
			unread: 0,
			topics: 0,
			category: 0
		},
		topics: {}
	};

	for(var instance in stats) {
		if (stats.hasOwnProperty(instance)) {
			totals.onlineGuestCount += stats[instance].onlineGuestCount;
			totals.onlineRegisteredCount += stats[instance].onlineRegisteredCount;
			totals.socketCount += stats[instance].socketCount;
			totals.users.categories += stats[instance].users.categories;
			totals.users.recent += stats[instance].users.recent;
			totals.users.unread += stats[instance].users.unread;
			totals.users.topics += stats[instance].users.topics;
			totals.users.category += stats[instance].users.category;

			stats[instance].topics.forEach(function(topic) {
				totals.topics[topic.tid] = totals.topics[topic.tid] || {count: 0, tid: topic.tid};
				totals.topics[topic.tid].count += topic.count;
			});
		}
	}

	var topTenTopics = [];
	Object.keys(totals.topics).forEach(function(tid) {
		topTenTopics.push({tid: tid, count: totals.topics[tid].count});
	});

	topTenTopics = topTenTopics.sort(function(a, b) {
		return b.count - a.count;
	}).slice(0, 10);

	var topTenTids = topTenTopics.map(function(topic) {
		return topic.tid;
	});

	topics.getTopicsFields(topTenTids, ['title'], function(err, titles) {
		if (err) {
			return callback(err);
		}
		totals.topics = {};
		topTenTopics.forEach(function(topic, index) {
			totals.topics[topic.tid] = {
				value: topic.count || 0,
				title: validator.escape(titles[index].title)
			};
		});

		callback(null, totals);
	});
};

SocketRooms.getStats = function() {
	return stats;
};

function getLocalStats(callback) {
	var websockets = require('../index');
	var io = websockets.server;
	if (!io) {
		return callback();
	}

	var roomClients = io.sockets.adapter.rooms;
	var socketData = {
		onlineGuestCount: websockets.getOnlineAnonCount(),
		onlineRegisteredCount: websockets.getOnlineUserCount(),
		socketCount: websockets.getSocketCount(),
		users: {
			categories: roomClients.categories ? Object.keys(roomClients.categories).length : 0,
			recent: roomClients.recent_topics ? Object.keys(roomClients.recent_topics).length : 0,
			unread: roomClients.unread_topics ? Object.keys(roomClients.unread_topics).length: 0,
			topics: 0,
			category: 0
		},
		topics: {}
	};

	var	topTenTopics = [],
		tid;

	for (var room in roomClients) {
		if (roomClients.hasOwnProperty(room)) {
			tid = room.match(/^topic_(\d+)/);
			if (tid) {
				var length = Object.keys(roomClients[room]).length;
				socketData.users.topics += length;

				topTenTopics.push({tid: tid[1], count: length});
			} else if (room.match(/^category/)) {
				socketData.users.category += Object.keys(roomClients[room]).length;
			}
		}
	}

	topTenTopics = topTenTopics.sort(function(a, b) {
		return b.count - a.count;
	}).slice(0, 10);

	socketData.topics = topTenTopics;
	callback(null, socketData);
}


module.exports = SocketRooms;