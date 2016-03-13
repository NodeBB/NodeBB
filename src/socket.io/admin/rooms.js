'use strict';


var os = require('os');
var nconf = require('nconf');
var winston = require('winston');
var validator = require('validator');
var topics = require('../../topics');
var pubsub = require('../../pubsub');

var stats = {};
var totals = {};
var SocketRooms = {
	stats: stats,
	totals: totals
};


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

pubsub.on('sync:stats:guests', function() {
	var io = require('../index').server;

	var roomClients = io.sockets.adapter.rooms;
	var guestCount = roomClients.online_guests ? roomClients.online_guests.length : 0;
	pubsub.publish('sync:stats:guests:end', guestCount);
});

SocketRooms.getTotalGuestCount = function(callback) {
	var count = 0;

	pubsub.on('sync:stats:guests:end', function(guestCount) {
		count += guestCount;
	});

	pubsub.publish('sync:stats:guests');

	setTimeout(function() {
		pubsub.removeAllListeners('sync:stats:guests:end');
		callback(null, count);
	}, 100);
}


SocketRooms.getAll = function(socket, data, callback) {
	pubsub.publish('sync:stats:start');

	totals.onlineGuestCount = 0;
	totals.onlineRegisteredCount = 0;
	totals.socketCount = 0;
	totals.topics = {};
	totals.users = {
		categories: 0,
		recent: 0,
		unread: 0,
		topics: 0,
		category: 0
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

SocketRooms.getOnlineUserCount = function(io) {
	if (!io) {
		return 0;
	}
	var count = 0;
	for (var key in io.sockets.adapter.rooms) {
		if (io.sockets.adapter.rooms.hasOwnProperty(key) && key.startsWith('uid_')) {
			++ count;
		}
	}

	return count;
};

function getLocalStats(callback) {
	var io = require('../index').server;

	if (!io) {
		return callback();
	}

	var roomClients = io.sockets.adapter.rooms;
	var socketData = {
		onlineGuestCount: roomClients.online_guests ? roomClients.online_guests.length : 0,
		onlineRegisteredCount: SocketRooms.getOnlineUserCount(io),
		socketCount: Object.keys(io.sockets.sockets).length,
		users: {
			categories: roomClients.categories ? roomClients.categories.length : 0,
			recent: roomClients.recent_topics ? roomClients.recent_topics.length : 0,
			unread: roomClients.unread_topics ? roomClients.unread_topics.length: 0,
			topics: 0,
			category: 0
		},
		topics: {}
	};

	var	topTenTopics = [];
	var tid;

	for (var room in roomClients) {
		if (roomClients.hasOwnProperty(room)) {
			tid = room.match(/^topic_(\d+)/);
			if (tid) {
				socketData.users.topics += roomClients[room].length;
				topTenTopics.push({tid: tid[1], count: roomClients[room].length});
			} else if (room.match(/^category/)) {
				socketData.users.category += roomClients[room].length;
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