'use strict';

const nconf = require('nconf');
const util = require('util');
const winston = require('winston');
const { EventEmitter } = require('events');
const connection = require('./connection');

let channelName;
const PubSub = function () {
	const self = this;
	const subClient = connection.connect();
	this.pubClient = connection.connect();

	channelName = `db:${nconf.get('redis:database')}:pubsub_channel`;
	subClient.subscribe(channelName);

	subClient.on('message', (channel, message) => {
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
};

util.inherits(PubSub, EventEmitter);

PubSub.prototype.publish = function (event, data) {
	this.pubClient.publish(channelName, JSON.stringify({ event, data }));
};

module.exports = new PubSub();
