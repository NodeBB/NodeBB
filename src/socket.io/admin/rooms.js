'use strict';

const os = require('os');
const nconf = require('nconf');

const topics = require('../../topics');
const pubsub = require('../../pubsub');
const utils = require('../../utils');

const stats = {};
const totals = {};

const SocketRooms = module.exports;

SocketRooms.stats = stats;
SocketRooms.totals = totals;

pubsub.on('sync:stats:start', () => {
	const stats = SocketRooms.getLocalStats();
	pubsub.publish('sync:stats:end', {
		stats: stats,
		id: `${os.hostname()}:${nconf.get('port')}`,
	});
});

pubsub.on('sync:stats:end', (data) => {
	stats[data.id] = data.stats;
});

pubsub.on('sync:stats:guests', (eventId) => {
	const Sockets = require('../index');
	const guestCount = Sockets.getCountInRoom('online_guests');
	pubsub.publish(eventId, guestCount);
});

SocketRooms.getTotalGuestCount = function (callback) {
	var count = 0;
	var eventId = `sync:stats:guests:end:${utils.generateUUID()}`;
	pubsub.on(eventId, (guestCount) => {
		count += guestCount;
	});

	pubsub.publish('sync:stats:guests', eventId);

	setTimeout(() => {
		pubsub.removeAllListeners(eventId);
		callback(null, count);
	}, 100);
};


SocketRooms.getAll = async function () {
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
		category: 0,
	};

	for (var instance in stats) {
		if (stats.hasOwnProperty(instance)) {
			totals.onlineGuestCount += stats[instance].onlineGuestCount;
			totals.onlineRegisteredCount += stats[instance].onlineRegisteredCount;
			totals.socketCount += stats[instance].socketCount;
			totals.users.categories += stats[instance].users.categories;
			totals.users.recent += stats[instance].users.recent;
			totals.users.unread += stats[instance].users.unread;
			totals.users.topics += stats[instance].users.topics;
			totals.users.category += stats[instance].users.category;

			stats[instance].topics.forEach((topic) => {
				totals.topics[topic.tid] = totals.topics[topic.tid] || { count: 0, tid: topic.tid };
				totals.topics[topic.tid].count += topic.count;
			});
		}
	}

	var topTenTopics = [];
	Object.keys(totals.topics).forEach((tid) => {
		topTenTopics.push({ tid: tid, count: totals.topics[tid].count || 0 });
	});

	topTenTopics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);

	var topTenTids = topTenTopics.map(topic => topic.tid);

	const titles = await topics.getTopicsFields(topTenTids, ['title']);
	totals.topTenTopics = topTenTopics.map((topic, index) => {
		topic.title = titles[index].title;
		return topic;
	});
	return totals;
};

SocketRooms.getOnlineUserCount = function (io) {
	var count = 0;

	if (io) {
		for (const [key] of io.sockets.adapter.rooms) {
			if (key.startsWith('uid_')) {
				count += 1;
			}
		}
	}

	return count;
};

SocketRooms.getLocalStats = function () {
	var Sockets = require('../index');
	var io = Sockets.server;

	var socketData = {
		onlineGuestCount: 0,
		onlineRegisteredCount: 0,
		socketCount: 0,
		users: {
			categories: 0,
			recent: 0,
			unread: 0,
			topics: 0,
			category: 0,
		},
		topics: {},
	};

	if (io && io.sockets) {
		socketData.onlineGuestCount = Sockets.getCountInRoom('online_guests');
		socketData.onlineRegisteredCount = SocketRooms.getOnlineUserCount(io);
		socketData.socketCount = io.sockets.sockets.size;
		socketData.users.categories = Sockets.getCountInRoom('categories');
		socketData.users.recent = Sockets.getCountInRoom('recent_topics');
		socketData.users.unread = Sockets.getCountInRoom('unread_topics');

		var topTenTopics = [];
		var tid;

		for (const [room, clients] of io.sockets.adapter.rooms) {
			tid = room.match(/^topic_(\d+)/);
			if (tid) {
				socketData.users.topics += clients.size;
				topTenTopics.push({ tid: tid[1], count: clients.size });
			} else if (room.match(/^category/)) {
				socketData.users.category += clients.size;
			}
		}

		topTenTopics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);
		socketData.topics = topTenTopics;
	}

	return socketData;
};

require('../../promisify')(SocketRooms);
