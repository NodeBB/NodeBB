'use strict';

import nconf from 'nconf';
import util from 'util';
import winston from 'winston';
import { EventEmitter } from 'events';
import connection from './connection';

let channelName;
const PubSub = function () {
	const self = this;
	channelName = `db:${nconf.get('redis:database')}:pubsub_channel`;
	self.queue = [];
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
			} catch (err: any) {
				winston.error(err.stack);
			}
		});
	});

	connection.connect().then((client) => {
		self.pubClient = client;
		self.queue.forEach(payload => client.publish(channelName, payload));
		self.queue.length = 0;
	});
};

util.inherits(PubSub, EventEmitter);

PubSub.prototype.publish = function (event, data) {
	const payload = JSON.stringify({ event: event, data: data });
	if (this.pubClient) {
		this.pubClient.publish(channelName, payload);
	} else {
		this.queue.push(payload);
	}
};

export default new PubSub();
