'use strict';

var nconf = require('nconf');

var real;
var fake = {
	publishQueue: [],
	publish: function (event, data) {
		fake.publishQueue.push({ event: event, data: data });
	},
	listenQueue: {},
	on: function (event, callback) {
		if (!Object.prototype.hasOwnProperty.call(fake.listenQueue, event)) {
			fake.listenQueue[event] = [];
		}
		fake.listenQueue[event].push(callback);
	},
	removeAllListeners: function (event) {
		delete fake.listenQueue[event];
	},
};

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

	if (!pubsub) {
		return fake;
	}

	Object.keys(fake.listenQueue).forEach(function (event) {
		fake.listenQueue[event].forEach(function (callback) {
			pubsub.on(event, callback);
		});
	});

	fake.publishQueue.forEach(function (msg) {
		pubsub.publish(msg.event, msg.data);
	});

	real = pubsub;
	fake = null;

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
