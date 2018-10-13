'use strict';

var assert = require('assert');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var pubsub = require('../src/pubsub');

describe('pubsub', function () {
	beforeEach(function () {
		pubsub.reset();
	});
	afterEach(function () {
		pubsub.reset();
	});
	it('should use singleHostCluster', function (done) {
		var oldValue = nconf.get('singleHostCluster');
		var isCluster = nconf.get('isCluster');
		nconf.set('singleHostCluster', true);
		nconf.set('isCluster', true);
		pubsub.on('testEvent', function (message) {
			assert.equal(message.foo, 1);
			nconf.set('singleHostCluster', oldValue);
			nconf.set('isCluster', isCluster);
			pubsub.removeAllListeners('testEvent');
			done();
		});
		pubsub.publish('testEvent', { foo: 1 });
	});

	it('should use the current database\'s pubsub', function (done) {
		var oldValue = nconf.get('singleHostCluster');
		var isCluster = nconf.get('isCluster');
		nconf.set('singleHostCluster', false);
		nconf.set('isCluster', true);
		pubsub.on('testEvent', function (message) {
			assert.equal(message.foo, 1);
			nconf.set('singleHostCluster', oldValue);
			nconf.set('isCluster', isCluster);
			pubsub.removeAllListeners('testEvent');
			done();
		});
		pubsub.publish('testEvent', { foo: 1 });
	});
});
