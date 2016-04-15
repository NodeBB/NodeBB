'use strict';
/*global require, before, after*/

var assert = require('assert'),
	db = require('./mocks/databasemock'),
	async = require('async'),
	User = require('../src/user'),
	Groups = require('../src/groups'),
	Messaging = require('../src/messaging'),
	testUids;

describe('Messaging Library', function() {
	before(function(done) {
		// Create 3 users: 1 admin, 2 regular
		async.parallel([
			async.apply(User.create, { username: 'foo', password: 'bar' }),	// admin
			async.apply(User.create, { username: 'baz', password: 'quux' }),	// restricted user
			async.apply(User.create, { username: 'herp', password: 'derp' })	// regular user
		], function(err, uids) {
			testUids = uids;
			async.parallel([
				async.apply(Groups.join, 'administrators', uids[0]),
				async.apply(User.setSetting, testUids[1], 'restrictChat', '1')
			], done);
		});
	});

	describe('.canMessage()', function() {
		it('should not error out', function(done) {
			Messaging.canMessageUser(testUids[1], testUids[2], function(err) {
				assert.ifError(err);
				done();
			});
		});

		it('should allow messages to be sent to an unrestricted user', function(done) {
			Messaging.canMessageUser(testUids[1], testUids[2], function(err) {
				assert.ifError(err);
				done();
			});
		});

		it('should NOT allow messages to be sent to a restricted user', function(done) {
			User.setSetting(testUids[1], 'restrictChat', '1', function() {
				Messaging.canMessageUser(testUids[2], testUids[1], function(err) {
					assert.strictEqual(err.message, '[[error:chat-restricted]]');
					done();
				});
			});
		});

		it('should always allow admins through', function(done) {
			Messaging.canMessageUser(testUids[0], testUids[1], function(err) {
				assert.ifError(err);
				done();
			});
		});

		it('should allow messages to be sent to a restricted user if restricted user follows sender', function(done) {
			User.follow(testUids[1], testUids[2], function() {
				Messaging.canMessageUser(testUids[2], testUids[1], function(err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	after(function() {
		db.flushdb();
	});
});
