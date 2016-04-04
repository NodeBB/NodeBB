'use strict';
/*global require, process, before, beforeEach, after*/

var winston = require('winston');

process.on('uncaughtException', function (err) {
	winston.error('Encountered error while running test suite: ' + err.message);
});

var	assert = require('assert'),
	async = require('async'),
	db = require('./mocks/databasemock');

var User = require('../src/user'),
	Topics = require('../src/topics'),
	Categories = require('../src/categories'),
	Meta = require('../src/meta'),
	Password = require('../src/password');

describe('User', function() {
	var	userData,
		testUid,
		testCid;

	before(function(done) {
		Categories.create({
			name: 'Test Category',
			description: 'A test',
			order: 1
		}, function(err, categoryObj) {
			testCid = categoryObj.cid;
			done();
		});
	});

	beforeEach(function(){
		userData = {
			username: 'John Smith',
			fullname: 'John Smith McNamara',
			password: 'swordfish',
			email: 'john@example.com',
			callback: undefined
		};
	});


	describe('.create(), when created', function() {
		it('should be created properly', function(done) {
			User.create({username: userData.username, password: userData.password, email: userData.email}, function(error,userId){
				assert.equal(error, null, 'was created with error');
				assert.ok(userId);

				testUid = userId;
				done();
			});
		});

		it('should have a valid email, if using an email', function(done) {
			User.create({username: userData.username, password: userData.password, email: 'fakeMail'},function(err) {
				assert(err);
				assert.equal(err.message, '[[error:invalid-email]]');
				done();
			});
		});
	});

	describe('.isModerator()', function() {
		it('should return false', function(done) {
			User.isModerator(testUid, testCid, function(err, isModerator) {
				assert.equal(isModerator, false);
				done();
			});
		});

		it('should return two false results', function(done) {
			User.isModerator([testUid, testUid], testCid, function(err, isModerator) {
				assert.equal(isModerator[0], false);
				assert.equal(isModerator[1], false);
				done();
			});
		});

		it('should return two false results', function(done) {
			User.isModerator(testUid, [testCid, testCid], function(err, isModerator) {
				assert.equal(isModerator[0], false);
				assert.equal(isModerator[1], false);
				done();
			});
		});
	});

	describe('.isReadyToPost()', function() {
		it('should error when a user makes two posts in quick succession', function(done) {
			Meta.config = Meta.config || {};
			Meta.config.postDelay = '10';

			async.series([
				async.apply(Topics.post, {
					uid: testUid,
					title: 'Topic 1',
					content: 'lorem ipsum',
					cid: testCid
				}),
				async.apply(Topics.post, {
					uid: testUid,
					title: 'Topic 2',
					content: 'lorem ipsum',
					cid: testCid
				})
			], function(err) {
				assert(err);
				done();
			});
		});

		it('should allow a post if the last post time is > 10 seconds', function(done) {
			User.setUserField(testUid, 'lastposttime', +new Date()-(11*1000), function() {
				Topics.post({
					uid: testUid,
					title: 'Topic 3',
					content: 'lorem ipsum',
					cid: testCid
				}, function(err) {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should error when a new user posts if the last post time is 10 < 30 seconds', function(done) {
			Meta.config.newbiePostDelay = 30;
			Meta.config.newbiePostDelayThreshold = 3;

			User.setUserField(testUid, 'lastposttime', +new Date()-(20*1000), function() {
				Topics.post({
					uid: testUid,
					title: 'Topic 4',
					content: 'lorem ipsum',
					cid: testCid
				}, function(err) {
					assert(err);
					done();
				});
			});
		});

		it('should not error if a non-newbie user posts if the last post time is 10 < 30 seconds', function(done) {
			User.setUserFields(testUid, {
				lastposttime:  +new Date()-(20*1000),
				reputation: 10
			}, function() {
				Topics.post({
					uid: testUid,
					title: 'Topic 5',
					content: 'lorem ipsum',
					cid: testCid
				}, function(err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('.search()', function() {
		it('should return an object containing an array of matching users', function(done) {
			User.search({query: 'john'}, function(err, searchData) {
				assert.ifError(err);
				assert.equal(Array.isArray(searchData.users) && searchData.users.length > 0, true);
				assert.equal(searchData.users[0].username, 'John Smith');
				done();
			});
		});
	});

	describe('.delete()', function() {
		var uid;
		before(function(done) {
			User.create({username: 'usertodelete', password: '123456', email: 'delete@me.com'}, function(err, newUid) {
				assert.ifError(err);
				uid = newUid;
				done();
			});
		});

		it('should delete a user account', function(done) {
			User.delete(1, uid, function(err) {
				assert.ifError(err);
				User.existsBySlug('usertodelete', function(err, exists) {
					assert.ifError(err);
					assert.equal(exists, false);
					done();
				});
			});
		});
	});

	describe('passwordReset', function() {
		var uid,
			code;
		before(function(done) {
			User.create({username: 'resetuser', password: '123456', email: 'reset@me.com'}, function(err, newUid) {
				assert.ifError(err);
				uid = newUid;
				done();
			});
		});

		it('.generate() should generate a new reset code', function(done) {
			User.reset.generate(uid, function(err, _code) {
				assert.ifError(err);
				assert(_code);

				code = _code;
				done();
			});
		});

		it('.validate() should ensure that this new code is valid', function(done) {
			User.reset.validate(code, function(err, valid) {
				assert.ifError(err);
				assert.strictEqual(valid, true);
				done();
			});
		});

		it('.validate() should correctly identify an invalid code', function(done) {
			User.reset.validate(code + 'abcdef', function(err, valid) {
				assert.ifError(err);
				assert.strictEqual(valid, false);
				done();
			});
		});

		it('.send() should create a new reset code and reset password', function(done) {
			User.reset.send('reset@me.com', function(err, code) {
				assert.ifError(err);
				done();
			});
		});

		it('.commit() should update the user\'s password', function(done) {
			User.reset.commit(code, 'newpassword', function(err) {
				assert.ifError(err);

				db.getObjectField('user:' + uid, 'password', function(err, newPassword) {
					assert.ifError(err);
					Password.compare('newpassword', newPassword, function(err, match) {
						assert.ifError(err);
						assert(match);
						done();
					});
				});
			});
		});
	});

	describe('hash methods', function() {

		it('should return uid from email', function(done) {
			User.getUidByEmail('john@example.com', function(err, uid) {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should return uid from username', function(done) {
			User.getUidByUsername('John Smith', function(err, uid) {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});

		it('should return uid from userslug', function(done) {
			User.getUidByUserslug('john-smith', function(err, uid) {
				assert.ifError(err);
				assert.equal(parseInt(uid, 10), parseInt(testUid, 10));
				done();
			});
		});
	});

	after(function() {
		db.flushdb();
	});
});