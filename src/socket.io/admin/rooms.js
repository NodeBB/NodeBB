'use strict';


var validator = require('validator');
var topics = require('../../topics');

var SocketRooms = {};

SocketRooms.getAll = function(socket, data, callback) {

	var websockets = require('../index');
	var io = websockets.server;
	if (!io) {
		return;
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
			popular: roomClients.popular_topics ? Object.keys(roomClients.popular_topics).length: 0,
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

	var topTenTids = topTenTopics.map(function(topic) {
		return topic.tid;
	});

	topics.getTopicsFields(topTenTids, ['title'], function(err, titles) {
		if (err) {
			return callback(err);
		}
		topTenTopics.forEach(function(topic, index) {
			socketData.topics[topic.tid] = {
				value: topic.count || 0,
				title: validator.escape(titles[index].title)
			};
		});

		callback(null, socketData);
	});
};

module.exports = SocketRooms;