'use strict';

var EventEmitter = require('events');
var nconf = require('nconf');

var real;

function get() {
	if (real) {
		return real;
	}

	var pubsub;

	if (nconf.get('isCluster') === 'false') {
		pubsub = new EventEmitter();
		pubsub.publish = pubsub.emit.bind(pubsub);
	} else if (nconf.get('singleHostCluster')) {
		pubsub = new EventEmitter();
		if (!process.send) {
			pubsub.publish = pubsub.emit.bind(pubsub);
		} else {
			pubsub.publish = function (event, data) {
				process.send({
					action: 'pubsub',
					event: event,
					data: data,
				});
			};
			process.on('message', function (message) {
				if (message && typeof message === 'object' && message.action === 'pubsub') {
					pubsub.emit(message.event, message.data);
				}
			});
		}
	} else if (nconf.get('redis')) {
		pubsub = require('./database/redis/pubsub');
	} else if (nconf.get('mongo')) {
		pubsub = require('./database/mongo/pubsub');
	} else if (nconf.get('postgres')) {
		pubsub = require('./database/postgres/pubsub');
	}

	real = pubsub;
	return pubsub;
}

module.exports = {
	publish: function (event, data) {
		get().publish(event, data);
	},
	on: function (event, callback) {
		get().on(event, callback);
	},
	removeAllListeners: function (event) {
		get().removeAllListeners(event);
	},
};
