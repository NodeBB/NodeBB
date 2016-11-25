'use strict';
/*globals require, before, after, describe, it*/

var assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var Flags = require('../src/flags');
var Categories = require('../src/categories');
var Topics = require('../src/topics');
var User = require('../src/user');

describe('Flags', function () {
	before(function (done) {
		// Create some stuff to flag
		async.waterfall([
			async.apply(User.create, {username: 'testUser', password: 'abcdef', email: 'b@c.com'}),
			function (uid, next) {
				Categories.create({
					name: 'test category'
				}, function (err, category) {
					if (err) {
						return done(err);
					}

					Topics.post({
						cid: category.cid,
						uid: uid,
						title: 'Topic to flag',
						content: 'This is flaggable content'
					}, next);
				});
			}
		], done);
	});

	describe('.create()', function () {
		it('should create a flag and return its data', function (done) {
			Flags.create('post', 1, 1, 'Test flag', function (err, flagData) {
				assert.ifError(err);
				var compare = {
					flagId: 1,
					uid: 1,
					targetId: 1,
					type: 'post',
					description: 'Test flag',
					state: 'open'
				};

				for(var key in compare) {
					if (compare.hasOwnProperty(key)) {
						assert.ok(flagData[key]);
						assert.strictEqual(flagData[key], compare[key]);
					}
				}

				done();
			});
		});
	});

	describe('.get()', function () {
		it('should retrieve and display a flag\'s data', function (done) {
			Flags.get(1, function (err, flagData) {
				assert.ifError(err);
				var compare = {
					flagId: 1,
					uid: 1,
					targetId: 1,
					type: 'post',
					description: 'Test flag',
					state: 'open'
				};

				for(var key in compare) {
					if (compare.hasOwnProperty(key)) {
						assert.ok(flagData[key]);
						assert.strictEqual(flagData[key], compare[key]);
					}
				}

				done();
			});
		});
	});

	describe('.list()', function () {
		it('should show a list of flags (with one item)', function (done) {
			Flags.list({}, function (err, flags) {
				assert.ifError(err);
				assert.ok(Array.isArray(flags));
				assert.equal(flags.length, 1);
				
				Flags.get(flags[0].flagId, function (err, flagData) {
					assert.ifError(err);
					assert.equal(flags[0].flagId, flagData.flagId);
					assert.equal(flags[0].description, flagData.description);
					done();
				});
			});
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
