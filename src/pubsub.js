
'use strict';

var nconf = require('nconf'),
	util = require('util'),
	winston = require('winston'),
	EventEmitter = require('events').EventEmitter;

var PubSub = function() {
	var self = this;
	if (nconf.get('redis')) {
		var redis = require('./database/redis');
		var subClient = redis.connect();
		this.pubClient = redis.connect();

		subClient.subscribe('pubsub_channel');

		subClient.on('message', function(channel, message) {
			if (channel !== 'pubsub_channel') {
				return;
			}

			try {
				var msg = JSON.parse(message);
				self.emit(msg.event, msg.data);
			} catch(err) {
				winston.error(err.stack);
			}
		});
	}
};

util.inherits(PubSub, EventEmitter);

PubSub.prototype.publish = function(event, data) {
	if (this.pubClient) {
		this.pubClient.publish('pubsub_channel', JSON.stringify({event: event, data: data}));
	} else {
		this.emit(event, data);
	}
};

var pubsub = new PubSub();

module.exports = pubsub;