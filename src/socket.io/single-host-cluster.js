'use strict';

var Client = {
	sendMessage: function (channel, message) {
		process.send({
			action: 'socket.io',
			channel: channel,
			message: message,
		});
	},
	trigger: function (channel, message) {
		Client.message.concat(Client.pmessage).forEach(function (callback) {
			setImmediate(function () {
				callback.call(Client, channel, message);
			});
		});
	},
	publish: function (channel, message) {
		Client.sendMessage(channel, message);
	},
	// we don't actually care about which channels we're subscribed to
	subscribe: function () {},
	psubscribe: function () {},
	unsubscribe: function () {},
	unpsubscribe: function () {},
	message: [],
	pmessage: [],
	on: function (event, callback) {
		if (event !== 'message' && event !== 'pmessage') {
			return;
		}
		Client[event].push(callback);
	},
	off: function (event, callback) {
		if (event !== 'message' && event !== 'pmessage') {
			return;
		}
		if (callback) {
			Client[event] = Client[event].filter(function (c) {
				return c !== callback;
			});
		} else {
			Client[event] = [];
		}
	},
};

process.on('message', function (message) {
	if (message && typeof message === 'object' && message.action === 'socket.io') {
		Client.trigger(message.channel, message.message);
	}
});

var adapter = require('socket.io-adapter-cluster')({
	client: Client,
});
// Otherwise, every node thinks it is the master node and ignores messages
// because they are from "itself".
Object.defineProperty(adapter.prototype, 'id', {
	get: function () {
		return process.pid;
	},
	set: function () {
		// ignore
	},
});
module.exports = adapter;
