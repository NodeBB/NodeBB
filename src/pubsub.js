'use strict';

var EventEmitter = require('events');
var nconf = require('nconf');

var real;
var noCluster;
var singleHost;

function get() {
	if (real) {
		return real;
	}

	var pubsub;

	if (nconf.get('isCluster') === 'false') {
		if (noCluster) {
			real = noCluster;
			return real;
		}
		noCluster = new EventEmitter();
		noCluster.publish = noCluster.emit.bind(noCluster);
		pubsub = noCluster;
	} else if (nconf.get('singleHostCluster')) {
		if (singleHost) {
			real = singleHost;
			return real;
		}
		singleHost = new EventEmitter();
		if (!process.send) {
			singleHost.publish = singleHost.emit.bind(singleHost);
		} else {
			singleHost.publish = function (event, data) {
				process.send({
					action: 'pubsub',
					event: event,
					data: data,
				});
			};
			process.on('message', function (message) {
				if (message && typeof message === 'object' && message.action === 'pubsub') {
					singleHost.emit(message.event, message.data);
				}
			});
		}
		pubsub = singleHost;
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
	reset: function () {
		real = null;
	},
};
