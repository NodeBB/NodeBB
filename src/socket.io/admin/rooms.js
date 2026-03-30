'use strict';

const topics = require('../../topics');
const io = require('..');
const webserver = require('../../webserver');

const totals = {};

const SocketRooms = module.exports;

SocketRooms.totals = totals;

SocketRooms.getTotalGuestCount = async function () {
	const s = await io.in('online_guests').fetchSockets();
	return s.length;
};

SocketRooms.getAll = async function () {
	const sockets = await io.server.fetchSockets();

	totals.onlineGuestCount = 0;
	totals.onlineRegisteredCount = 0;
	totals.socketCount = sockets.length;
	totals.topTenTopics = [];
	totals.users = {
		categories: 0,
		recent: 0,
		unread: 0,
		topics: 0,
		category: 0,
	};
	const userRooms = {};
	const topicData = {};
	for (const s of sockets) {
		for (const key of s.rooms) {
			if (key === 'online_guests') {
				totals.onlineGuestCount += 1;
			} else if (key === 'categories') {
				totals.users.categories += 1;
			} else if (key === 'recent_topics') {
				totals.users.recent += 1;
			} else if (key === 'unread_topics') {
				totals.users.unread += 1;
			} else if (key.startsWith('uid_')) {
				userRooms[key] = 1;
			} else if (key.startsWith('category_')) {
				totals.users.category += 1;
			} else {
				const tid = key.match(/^topic_(\d+)/);
				if (tid) {
					totals.users.topics += 1;
					topicData[tid[1]] = topicData[tid[1]] || { count: 0 };
					topicData[tid[1]].count += 1;
				}
			}
		}
	}
	totals.onlineRegisteredCount = Object.keys(userRooms).length;

	let topTenTopics = [];
	Object.keys(topicData).forEach((tid) => {
		topTenTopics.push({ tid: tid, count: topicData[tid].count });
	});
	topTenTopics = topTenTopics.sort((a, b) => b.count - a.count).slice(0, 10);
	const topTenTids = topTenTopics.map(topic => topic.tid);

	const titles = await topics.getTopicsFields(topTenTids, ['title']);
	totals.topTenTopics = topTenTopics.map((topic, index) => {
		topic.title = titles[index].title;
		return topic;
	});

	return totals;
};

SocketRooms.getOnlineUserCount = function (io) {
	let count = 0;

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
	const Sockets = require('../index');
	const io = Sockets.server;

	const socketData = {
		onlineGuestCount: 0,
		onlineRegisteredCount: 0,
		socketCount: 0,
		connectionCount: webserver.getConnectionCount(),
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

		let topTenTopics = [];
		let tid;

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
