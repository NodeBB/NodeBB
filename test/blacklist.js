'use strict';

/* global require, after, before */


var async = require('async');
var assert = require('assert');

var db = require('./mocks/databasemock');
var groups = require('../src/groups');
var user = require('../src/user');
var blacklist = require('../src/meta/blacklist');

describe('blacklist', function () {
	var adminUid;

	before(function (done) {
		user.create({ username: 'admin' }, function (err, uid) {
			assert.ifError(err);
			adminUid = uid;
			groups.join('administrators', adminUid, done);
		});
	});

	var socketBlacklist = require('../src/socket.io/blacklist');
	var rules = '1.1.1.1\n2.2.2.2\n::ffff:0:2.2.2.2\n127.0.0.1\n192.168.100.0/22';

	it('should validate blacklist', function (done) {
		socketBlacklist.validate({ uid: adminUid }, {
			rules: rules,
		}, function (err, data) {
			assert.ifError(err);
			done();
		});
	});

	it('should error if not admin', function (done) {
		socketBlacklist.save({ uid: 0 }, rules, function (err) {
			assert.equal(err.message, '[[error:no-privileges]]');
			done();
		});
	});

	it('should save blacklist', function (done) {
		socketBlacklist.save({ uid: adminUid }, rules, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should pass ip test against blacklist', function (done) {
		blacklist.test('3.3.3.3', function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should fail ip test against blacklist', function (done) {
		blacklist.test('1.1.1.1', function (err) {
			assert.equal(err.message, '[[error:blacklisted-ip]]');
			done();
		});
	});

	it('should pass ip test and not crash with ipv6 address', function (done) {
		blacklist.test('2001:db8:85a3:0:0:8a2e:370:7334', function (err) {
			assert.ifError(err);
			done();
		});
	});
});
