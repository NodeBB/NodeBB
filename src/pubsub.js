'use strict';

var nconf = require('nconf');

var real;

function get() {
	if (real) {
		return real;
	}

	var pubsub;

	if (nconf.get('isCluster') === 'false') {
		var EventEmitter = require('events');
		pubsub = new EventEmitter();
		pubsub.publish = pubsub.emit.bind(pubsub);
	} else if (nconf.get('redis')) {
		pubsub = require('./database/redis/pubsub');
	} else if (nconf.get('mongo')) {
		pubsub = require('./database/mongo/pubsub');
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
