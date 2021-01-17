'use strict';

const Client = {
	sendMessage(channel, message) {
		process.send({
			action: 'socket.io',
			channel,
			message,
		});
	},
	trigger(channel, message) {
		Client.message.concat(Client.pmessage).forEach((callback) => {
			setImmediate(() => {
				callback.call(Client, channel, message);
			});
		});
	},
	publish(channel, message) {
		Client.sendMessage(channel, message);
	},
	// we don't actually care about which channels we're subscribed to
	subscribe() {},
	psubscribe() {},
	unsubscribe() {},
	unpsubscribe() {},
	message: [],
	pmessage: [],
	on(event, callback) {
		if (event !== 'message' && event !== 'pmessage') {
			return;
		}
		Client[event].push(callback);
	},
	off(event, callback) {
		if (event !== 'message' && event !== 'pmessage') {
			return;
		}
		if (callback) {
			Client[event] = Client[event].filter(c => c !== callback);
		} else {
			Client[event] = [];
		}
	},
};

process.on('message', (message) => {
	if (message && typeof message === 'object' && message.action === 'socket.io') {
		Client.trigger(message.channel, message.message);
	}
});

const adapter = require('socket.io-adapter-cluster')({
	client: Client,
});
// Otherwise, every node thinks it is the master node and ignores messages
// because they are from "itself".
Object.defineProperty(adapter.prototype, 'id', {
	get() {
		return process.pid;
	},
	set() {
		// ignore
	},
});
module.exports = adapter;
