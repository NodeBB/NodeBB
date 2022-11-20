'use strict';

const EventEmitter = require('events');
import nconf from 'nconf';

let real;
let noCluster;
let singleHost;

function get() {
	if (real) {
		return real;
	}

	let pubsub;

	if (!nconf.get('isCluster')) {
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
		if (!(process as any).send) {
			singleHost.publish = singleHost.emit.bind(singleHost);
		} else {
			singleHost.publish = function (event, data) {
				(process as any).send({
					action: 'pubsub',
					event: event,
					data: data,
				});
			};
			(process as any).on('message', (message: any) => {
				if (message && typeof message === 'object' && message.action === 'pubsub') {
					singleHost.emit(message.event, message.data);
				}
			});
		}
		pubsub = singleHost;
	} else if (nconf.get('redis')) {
		pubsub = require('./database/redis/pubsub');
	} else {
		throw new Error('[[error:redis-required-for-pubsub]]');
	}

	real = pubsub;
	return pubsub;
}

export default  {
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
