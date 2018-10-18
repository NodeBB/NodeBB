'use strict';

var assert = require('assert');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var settings = require('../src/settings');

describe('settings v3', function () {
	var settings1;
	var settings2;

	it('should create a new settings object', function (done) {
		settings1 = new settings('my-plugin', '1.0', { foo: 1, bar: { derp: 2 } }, done);
	});

	it('should get the saved settings ', function (done) {
		assert.equal(settings1.get('foo'), 1);
		assert.equal(settings1.get('bar.derp'), 2);
		done();
	});

	it('should create a new settings instance for same key', function (done) {
		settings2 = new settings('my-plugin', '1.0', { foo: 1, bar: { derp: 2 } }, done);
	});

	it('should pass change between settings object over pubsub', function (done) {
		settings1.set('foo', 3);
		settings1.persist(function (err) {
			assert.ifError(err);
			// give pubsub time to complete
			setTimeout(function () {
				assert.equal(settings2.get('foo'), 3);
				done();
			}, 500);
		});
	});

	it('should set a nested value', function (done) {
		settings1.set('bar.derp', 5);
		assert.equal(settings1.get('bar.derp'), 5);
		done();
	});

	it('should reset the settings to default', function (done) {
		settings1.reset(function (err) {
			assert.ifError(err);
			assert.equal(settings1.get('foo'), 1);
			assert.equal(settings1.get('bar.derp'), 2);
			done();
		});
	});

	it('should get value from default value', function (done) {
		var newSettings = new settings('some-plugin', '1.0', { default: { value: 1 } });
		assert.equal(newSettings.get('default.value'), 1);
		done();
	});
});
