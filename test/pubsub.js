'use strict';

var assert = require('assert');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var pubsub = require('../src/pubsub');

describe('pubsub', () => {
	it('should use the plain event emitter', (done) => {
		nconf.set('isCluster', false);
		pubsub.reset();
		pubsub.on('testEvent', (message) => {
			assert.equal(message.foo, 1);
			pubsub.removeAllListeners('testEvent');
			done();
		});
		pubsub.publish('testEvent', { foo: 1 });
	});

	it('should use same event emitter', (done) => {
		pubsub.on('dummyEvent', (message) => {
			assert.equal(message.foo, 2);
			pubsub.removeAllListeners('dummyEvent');
			pubsub.reset();
			done();
		});
		pubsub.publish('dummyEvent', { foo: 2 });
	});

	it('should use singleHostCluster', (done) => {
		var oldValue = nconf.get('singleHostCluster');
		nconf.set('singleHostCluster', true);
		pubsub.on('testEvent', (message) => {
			assert.equal(message.foo, 3);
			nconf.set('singleHostCluster', oldValue);
			pubsub.removeAllListeners('testEvent');
			done();
		});
		pubsub.publish('testEvent', { foo: 3 });
	});

	it('should use same event emitter', (done) => {
		var oldValue = nconf.get('singleHostCluster');
		pubsub.on('dummyEvent', (message) => {
			assert.equal(message.foo, 4);
			nconf.set('singleHostCluster', oldValue);
			pubsub.removeAllListeners('dummyEvent');
			pubsub.reset();
			done();
		});
		pubsub.publish('dummyEvent', { foo: 4 });
	});
});
