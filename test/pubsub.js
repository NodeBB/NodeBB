'use strict';

var assert = require('assert');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var pubsub = require('../src/pubsub');

describe('pubsub', function () {
	it('should use singleHostCluster', function (done) {
		var oldValue = nconf.get('singleHostCluster');
		nconf.set('singleHostCluster', true);
		pubsub.on('testEvent', function (message) {
			assert.equal(message.foo, 1);
			nconf.set('singleHostCluster', oldValue);

			pubsub.removeAllListeners('testEvent');
			done();
		});
		pubsub.publish('testEvent', { foo: 1 });
	});

	it('should use the current database\'s pubsub', function (done) {
		var oldValue = nconf.get('singleHostCluster');
		nconf.set('singleHostCluster', false);
		pubsub.on('testEvent', function (message) {
			assert.equal(message.foo, 1);
			nconf.set('singleHostCluster', oldValue);
			pubsub.removeAllListeners('testEvent');
			done();
		});
		pubsub.publish('testEvent', { foo: 1 });
	});
});
