'use strict';

var assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var meta = require('../src/meta');
var User = require('../src/user');
var Groups = require('../src/groups');

describe('Messaging Library', function () {
	var fooUid;
	var bazUid;
	var herpUid;

	before(function (done) {
		Groups.resetCache();
		// Create 3 users: 1 admin, 2 regular
		async.series([
			async.apply(User.create, { username: 'foo', password: 'barbar' }),	// admin
			async.apply(User.create, { username: 'baz', password: 'quuxquux' }),	// restricted user
			async.apply(User.create, { username: 'herp', password: 'derpderp' })	// regular user
		], function (err, uids) {
			if (err) {
				return done(err);
			}

			fooUid = uids[0];
			bazUid = uids[1];
			herpUid = uids[2];

			Groups.join('administrators', fooUid, done);
		});
	});

	describe('settings', function () {
		var socketAdmin = require('../src/socket.io/admin');
		it('it should set setting', function (done) {
			socketAdmin.settings.set({uid: fooUid}, {hash: 'some:hash', values: {foo: '1', derp: 'value'}}, function (err) {
				assert.ifError(err);
				db.getObject('settings:some:hash', function (err, data) {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('it should get setting', function (done) {
			socketAdmin.settings.get({uid: fooUid}, {hash: 'some:hash'}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.foo, '1');
				assert.equal(data.derp, 'value');
				done();
			});
		});

		it('should not set setting if not empty', function (done) {
			meta.settings.setOnEmpty('some:hash', {foo: 2}, function (err) {
				assert.ifError(err);
				db.getObject('settings:some:hash', function (err, data) {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					done();
				});
			});
		});

		it('should set setting if empty', function (done) {
			meta.settings.setOnEmpty('some:hash', {empty: '2'}, function (err) {
				assert.ifError(err);
				db.getObject('settings:some:hash', function (err, data) {
					assert.ifError(err);
					assert.equal(data.foo, '1');
					assert.equal(data.derp, 'value');
					assert.equal(data.empty, '2');
					done();
				});
			});
		});

		it('should set one and get one', function (done) {
			meta.settings.setOne('some:hash', 'myField', 'myValue', function (err) {
				assert.ifError(err);
				meta.settings.getOne('some:hash', 'myField', function (err, myValue) {
					assert.ifError(err);
					assert.equal(myValue, 'myValue');
					done();
				});
			});
		});

	});





	after(function (done) {
		db.emptydb(done);
	});
});
