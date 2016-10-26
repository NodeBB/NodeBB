'use strict';

var assert = require('assert');
var async = require('async');
var request = require('request');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var meta = require('../src/meta');
var User = require('../src/user');
var Groups = require('../src/groups');
var Messaging = require('../src/messaging');
var helpers = require('./helpers');

describe('Messaging Library', function () {
	var testUids;
	var fooUid;
	var bazUid;
	var herpUid;
	var roomId;

	before(function (done) {
		// Create 3 users: 1 admin, 2 regular
		async.parallel([
			async.apply(User.create, { username: 'foo', password: 'barbar' }),	// admin
			async.apply(User.create, { username: 'baz', password: 'quuxquux' }),	// restricted user
			async.apply(User.create, { username: 'herp', password: 'derpderp' })	// regular user
		], function (err, uids) {
			if (err) {
				return done(err);
			}

			testUids = uids;
			fooUid = uids[0];
			bazUid = uids[1];
			herpUid = uids[2];

			async.parallel([
				async.apply(Groups.join, 'administrators', uids[0]),
				async.apply(User.setSetting, testUids[1], 'restrictChat', '1')
			], done);
		});
	});

	describe('.canMessage()', function () {
		it('should not error out', function (done) {
			Messaging.canMessageUser(testUids[1], testUids[2], function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should allow messages to be sent to an unrestricted user', function (done) {
			Messaging.canMessageUser(testUids[1], testUids[2], function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should NOT allow messages to be sent to a restricted user', function (done) {
			User.setSetting(testUids[1], 'restrictChat', '1', function () {
				Messaging.canMessageUser(testUids[2], testUids[1], function (err) {
					assert.strictEqual(err.message, '[[error:chat-restricted]]');
					done();
				});
			});
		});

		it('should always allow admins through', function (done) {
			Messaging.canMessageUser(testUids[0], testUids[1], function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should allow messages to be sent to a restricted user if restricted user follows sender', function (done) {
			User.follow(testUids[1], testUids[2], function () {
				Messaging.canMessageUser(testUids[2], testUids[1], function (err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('rooms', function () {
		it('should create a new chat room', function (done) {
			Messaging.newRoom(fooUid, [bazUid, herpUid], function (err, _roomId) {
				roomId = _roomId;
				assert.ifError(err);
				assert(roomId);
				done();
			});
		});

		it('should leave the chat room', function (done) {
			Messaging.leaveRoom([bazUid], roomId, function (err) {
				assert.ifError(err);
				Messaging.isUserInRoom(bazUid, roomId, function (err, isUserInRoom) {
					assert.ifError(err);
					assert.equal(isUserInRoom, false);
					done();
				});
			});
		});

		it('should send a message to a room', function (done) {
			Messaging.sendMessage(fooUid, roomId, 'first chat message', Date.now(), function (err, messageData) {
				assert.ifError(err);
				assert(messageData);
				assert.equal(messageData.content, 'first chat message');
				assert(messageData.fromUser);
				assert(messageData.roomId, roomId);
				done();
			});
		});

		it('should get messages from room', function (done) {
			Messaging.getMessages({
				callerUid: fooUid,
				uid: fooUid,
				roomId: roomId,
				markRead: true
			}, function (err, messages) {
				assert.ifError(err);
				assert(Array.isArray(messages));
				assert.equal(messages[0].roomId, roomId);
				assert.equal(messages[0].fromuid, fooUid);
				done();
			});
		});
	});

	describe('controller', function () {
		it('should 404 if chat is disabled', function (done) {
			meta.config.disableChat = 1;
			request(nconf.get('url') + '/user/baz/chats', function (err, response) {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should 404 for guest', function (done) {
			meta.config.disableChat = 0;
			request(nconf.get('url') + '/user/baz/chats', function (err, response) {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should 404 for non-existent user', function (done) {
			request(nconf.get('url') + '/user/doesntexist/chats', function (err, response) {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

	});

	describe('logged in chat controller', function () {
		var jar;
		before(function (done) {
			helpers.loginUser('herp', 'derpderp', function (err, _jar) {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should return chats page data', function (done) {
			request(nconf.get('url') + '/api/user/herp/chats', {json: true, jar: jar}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(Array.isArray(body.rooms));
				assert.equal(body.rooms.length, 1);
				assert.equal(body.title, '[[pages:chats]]');
				done();
			});
		});

		it('should return room data', function (done) {
			request(nconf.get('url') + '/api/user/herp/chats/' + roomId, {json: true, jar: jar}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert.equal(body.roomId, roomId);
				assert.equal(body.isOwner, false);
				done();
			});
		});

		it('should redirect to chats page', function (done) {
			request(nconf.get('url') + '/api/chats', {jar: jar}, function (err, response, body) {
				assert.ifError(err);
				assert.equal(body, '"/user/herp/chats"');
				assert.equal(response.statusCode, 308);
				done();
			});
		});

		it('should return 404 if user is not in room', function (done) {
			helpers.loginUser('baz', 'quuxquux', function (err, jar) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/user/baz/chats/' + roomId, {json: true, jar: jar}, function (err, response, body) {
					assert.ifError(err);
					assert.equal(response.statusCode, 404);
					done();
				});
			});
		});
	});


	after(function (done) {
		db.emptydb(done);
	});
});
