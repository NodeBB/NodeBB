'use strict';

const nconf = require('nconf');
const util = require('util');
const winston = require('winston');
const EventEmitter = require('events').EventEmitter;
const connection = require('./connection');

let channelName;
const PubSub = function () {
	const self = this;
	channelName = `db:${nconf.get('redis:database')}:pubsub_channel`;

	connection.connect().then((client) => {
		self.subClient = client;
		self.subClient.subscribe(channelName);
		self.subClient.on('message', (channel, message) => {
			if (channel !== channelName) {
				return;
			}

			try {
				const msg = JSON.parse(message);
				self.emit(msg.event, msg.data);
			} catch (err) {
				winston.error(err.stack);
			}
		});
	});

	connection.connect().then((client) => {
		self.pubClient = client;
	});
};

util.inherits(PubSub, EventEmitter);

PubSub.prototype.publish = function (event, data) {
	this.pubClient.publish(channelName, JSON.stringify({ event: event, data: data }));
};

module.exports = new PubSub();
