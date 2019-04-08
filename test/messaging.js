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
var socketModules = require('../src/socket.io/modules');

describe('Messaging Library', function () {
	var fooUid;	// the admin
	var bazUid;	// the user with chat restriction enabled
	var herpUid;
	var roomId;

	before(function (done) {
		// Create 3 users: 1 admin, 2 regular
		async.series([
			async.apply(User.create, { username: 'foo', password: 'barbar' }),	// admin
			async.apply(User.create, { username: 'baz', password: 'quuxquux' }),	// restricted user
			async.apply(User.create, { username: 'herp', password: 'derpderp' }),	// regular user
		], function (err, uids) {
			if (err) {
				return done(err);
			}

			fooUid = uids[0];
			bazUid = uids[1];
			herpUid = uids[2];

			async.parallel([
				async.apply(Groups.join, 'administrators', fooUid),
				async.apply(User.setSetting, bazUid, 'restrictChat', '1'),
			], done);
		});
	});

	describe('.canMessage()', function () {
		it('should allow messages to be sent to an unrestricted user', function (done) {
			Messaging.canMessageUser(bazUid, herpUid, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should NOT allow messages to be sent to a restricted user', function (done) {
			User.setSetting(bazUid, 'restrictChat', '1', function (err) {
				assert.ifError(err);
				Messaging.canMessageUser(herpUid, bazUid, function (err) {
					assert.strictEqual(err.message, '[[error:chat-restricted]]');
					socketModules.chats.addUserToRoom({ uid: herpUid }, { roomId: 1, username: 'baz' }, function (err) {
						assert.equal(err.message, '[[error:chat-restricted]]');
						done();
					});
				});
			});
		});

		it('should always allow admins through', function (done) {
			Messaging.canMessageUser(fooUid, bazUid, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should allow messages to be sent to a restricted user if restricted user follows sender', function (done) {
			User.follow(bazUid, herpUid, function () {
				Messaging.canMessageUser(herpUid, bazUid, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('rooms', function () {
		it('should fail to create a new chat room with invalid data', function (done) {
			socketModules.chats.newRoom({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return rate limit error on second try', function (done) {
			var socketMock = { uid: fooUid };
			var oldValue = meta.config.chatMessageDelay;
			meta.config.chatMessageDelay = 1000;
			socketModules.chats.newRoom(socketMock, { touid: bazUid }, function (err) {
				assert.ifError(err);
				socketModules.chats.newRoom(socketMock, { touid: bazUid }, function (err) {
					assert.equal(err.message, '[[error:too-many-messages]]');
					meta.configs.chatMessageDelay = oldValue;
					done();
				});
			});
		});

		it('should create a new chat room', function (done) {
			socketModules.chats.newRoom({ uid: fooUid }, { touid: bazUid }, function (err, _roomId) {
				roomId = _roomId;
				assert.ifError(err);
				assert(roomId);
				socketModules.chats.canMessage({ uid: fooUid }, _roomId, function (err) {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should fail to add user to room with invalid data', function (done) {
			socketModules.chats.addUserToRoom({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: null }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should add a user to room', function (done) {
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'herp' }, function (err) {
				assert.ifError(err);
				Messaging.isUserInRoom(herpUid, roomId, function (err, isInRoom) {
					assert.ifError(err);
					assert(isInRoom);
					done();
				});
			});
		});

		it('should fail to add users to room if max is reached', function (done) {
			meta.config.maximumUsersInChatRoom = 2;
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'test' }, function (err) {
				assert.equal(err.message, '[[error:cant-add-more-users-to-chat-room]]');
				meta.config.maximumUsersInChatRoom = 0;
				done();
			});
		});

		it('should fail to add users to room if user does not exist', function (done) {
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'doesnotexist' }, function (err) {
				assert.equal(err.message, '[[error:no-user]]');
				done();
			});
		});

		it('should fail to add self to room', function (done) {
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'foo' }, function (err) {
				assert.equal(err.message, '[[error:cant-chat-with-yourself]]');
				done();
			});
		});

		it('should fail to leave room with invalid data', function (done) {
			socketModules.chats.leave({ uid: null }, roomId, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.leave({ uid: fooUid }, null, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should leave the chat room', function (done) {
			socketModules.chats.leave({ uid: bazUid }, roomId, function (err) {
				assert.ifError(err);
				Messaging.isUserInRoom(bazUid, roomId, function (err, isUserInRoom) {
					assert.ifError(err);
					assert.equal(isUserInRoom, false);
					Messaging.getRoomData(roomId, function (err, data) {
						assert.ifError(err);
						assert.equal(data.owner, fooUid);
						done();
					});
				});
			});
		});

		it('should change owner when owner leaves room', function (done) {
			socketModules.chats.newRoom({ uid: herpUid }, { touid: fooUid }, function (err, roomId) {
				assert.ifError(err);
				socketModules.chats.addUserToRoom({ uid: herpUid }, { roomId: roomId, username: 'baz' }, function (err) {
					assert.ifError(err);
					socketModules.chats.leave({ uid: herpUid }, roomId, function (err) {
						assert.ifError(err);
						Messaging.getRoomData(roomId, function (err, data) {
							assert.ifError(err);
							assert.equal(data.owner, fooUid);
							done();
						});
					});
				});
			});
		});

		it('should change owner if owner is deleted', function (done) {
			User.create({ username: 'deleted_chat_user' }, function (err, sender) {
				assert.ifError(err);
				User.create({ username: 'receiver' }, function (err, receiver) {
					assert.ifError(err);
					socketModules.chats.newRoom({ uid: sender }, { touid: receiver }, function (err, roomId) {
						assert.ifError(err);
						User.deleteAccount(sender, function (err) {
							assert.ifError(err);
							Messaging.getRoomData(roomId, function (err, data) {
								assert.ifError(err);
								assert.equal(data.owner, receiver);
								done();
							});
						});
					});
				});
			});
		});

		it('should fail to remove user from room', function (done) {
			socketModules.chats.removeUserFromRoom({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.removeUserFromRoom({ uid: fooUid }, {}, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should fail to remove user from room if user does not exist', function (done) {
			socketModules.chats.removeUserFromRoom({ uid: fooUid }, { roomId: roomId, uid: 99 }, function (err) {
				assert.equal('[[error:no-user]]', err.message);
				done();
			});
		});

		it('should remove user from room', function (done) {
			socketModules.chats.newRoom({ uid: fooUid }, { touid: herpUid }, function (err, roomId) {
				assert.ifError(err);
				Messaging.isUserInRoom(herpUid, roomId, function (err, isInRoom) {
					assert.ifError(err);
					assert(isInRoom);
					socketModules.chats.removeUserFromRoom({ uid: fooUid }, { roomId: roomId, uid: herpUid }, function (err) {
						assert.equal(err.message, '[[error:cant-remove-last-user]]');
						socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'baz' }, function (err) {
							assert.ifError(err);
							socketModules.chats.removeUserFromRoom({ uid: fooUid }, { roomId: roomId, uid: herpUid }, function (err) {
								assert.ifError(err);
								Messaging.isUserInRoom(herpUid, roomId, function (err, isInRoom) {
									assert.ifError(err);
									assert(!isInRoom);
									done();
								});
							});
						});
					});
				});
			});
		});

		it('should fail to send a message to room with invalid data', function (done) {
			socketModules.chats.send({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.send({ uid: fooUid }, { roomId: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.send({ uid: null }, { roomId: 1 }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should fail to send chat if content is empty', function (done) {
			socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: ' ' }, function (err) {
				assert.equal(err.message, '[[error:invalid-chat-message]]');
				done();
			});
		});

		it('should send a message to a room', function (done) {
			socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: 'first chat message' }, function (err, messageData) {
				assert.ifError(err);
				assert(messageData);
				assert.equal(messageData.content, 'first chat message');
				assert(messageData.fromUser);
				assert(messageData.roomId, roomId);
				socketModules.chats.getRaw({ uid: fooUid }, { mid: messageData.mid }, function (err, raw) {
					assert.ifError(err);
					assert.equal(raw, 'first chat message');
					setTimeout(done, 300);
				});
			});
		});

		it('should fail to send second message due to rate limit', function (done) {
			var socketMock = { uid: fooUid };
			var oldValue = meta.config.chatMessageDelay;
			meta.config.chatMessageDelay = 1000;
			socketModules.chats.send(socketMock, { roomId: roomId, message: 'first chat message' }, function (err) {
				assert.ifError(err);
				socketModules.chats.send(socketMock, { roomId: roomId, message: 'first chat message' }, function (err) {
					assert.equal(err.message, '[[error:too-many-messages]]');
					meta.config.chatMessageDelay = oldValue;
					done();
				});
			});
		});

		it('should return invalid-data error', function (done) {
			socketModules.chats.getRaw({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getRaw({ uid: fooUid }, { }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should return not allowed error if mid is not in room', function (done) {
			var myRoomId;
			User.create({ username: 'dummy' }, function (err, uid) {
				assert.ifError(err);
				socketModules.chats.newRoom({ uid: bazUid }, { touid: uid }, function (err, _roomId) {
					myRoomId = _roomId;
					assert.ifError(err);
					assert(myRoomId);
					socketModules.chats.getRaw({ uid: bazUid }, { mid: 1 }, function (err) {
						assert.equal(err.message, '[[error:not-allowed]]');
						socketModules.chats.send({ uid: bazUid }, { roomId: myRoomId, message: 'admin will see this' }, function (err, message) {
							assert.ifError(err);
							socketModules.chats.getRaw({ uid: fooUid }, { mid: message.mid }, function (err, raw) {
								assert.ifError(err);
								assert.equal(raw, 'admin will see this');
								done();
							});
						});
					});
				});
			});
		});


		it('should notify offline users of message', function (done) {
			Messaging.notificationSendDelay = 100;

			db.sortedSetAdd('users:online', Date.now() - ((meta.config.onlineCutoff * 60000) + 50000), herpUid, function (err) {
				assert.ifError(err);
				socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: 'second chat message' }, function (err) {
					assert.ifError(err);
					setTimeout(function () {
						User.notifications.get(herpUid, function (err, data) {
							assert.ifError(err);
							assert(data.unread[0]);
							var notification = data.unread[0];
							assert.equal(notification.bodyShort, '[[notifications:new_message_from, foo]]');
							assert.equal(notification.nid, 'chat_' + fooUid + '_' + roomId);
							assert.equal(notification.path, '/chats/' + roomId);
							done();
						});
					}, 1500);
				});
			});
		});

		it('should fail to get messages from room with invalid data', function (done) {
			socketModules.chats.getMessages({ uid: null }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getMessages({ uid: fooUid }, null, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.getMessages({ uid: fooUid }, { uid: null }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						socketModules.chats.getMessages({ uid: fooUid }, { uid: 1, roomId: null }, function (err) {
							assert.equal(err.message, '[[error:invalid-data]]');
							done();
						});
					});
				});
			});
		});

		it('should get messages from room', function (done) {
			socketModules.chats.getMessages({ uid: fooUid }, {
				uid: fooUid,
				roomId: roomId,
				start: 0,
			}, function (err, messages) {
				assert.ifError(err);
				assert(Array.isArray(messages));
				assert.equal(messages[0].roomId, roomId);
				assert.equal(messages[0].fromuid, fooUid);
				done();
			});
		});

		it('should fail to mark read with invalid data', function (done) {
			socketModules.chats.markRead({ uid: null }, roomId, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.markRead({ uid: fooUid }, null, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should not error if user is not in room', function (done) {
			socketModules.chats.markRead({ uid: herpUid }, 10, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should mark room read', function (done) {
			socketModules.chats.markRead({ uid: fooUid }, roomId, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should mark all rooms read', function (done) {
			socketModules.chats.markAllRead({ uid: fooUid }, {}, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should fail to rename room with invalid data', function (done) {
			socketModules.chats.renameRoom({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.renameRoom({ uid: fooUid }, { roomId: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.renameRoom({ uid: fooUid }, { roomId: roomId, newName: null }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should rename room', function (done) {
			socketModules.chats.renameRoom({ uid: fooUid }, { roomId: roomId, newName: 'new room name' }, function (err) {
				assert.ifError(err);
				done();
			});
		});

		it('should fail to load room with invalid-data', function (done) {
			socketModules.chats.loadRoom({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.loadRoom({ uid: fooUid }, { roomId: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should fail to load room if user is not in', function (done) {
			socketModules.chats.loadRoom({ uid: 0 }, { roomId: roomId }, function (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should load chat room', function (done) {
			socketModules.chats.loadRoom({ uid: fooUid }, { roomId: roomId }, function (err, data) {
				assert.ifError(err);
				assert(data);
				assert.equal(data.roomName, 'new room name');
				done();
			});
		});

		it('should return true if user is dnd', function (done) {
			db.setObjectField('user:' + herpUid, 'status', 'dnd', function (err) {
				assert.ifError(err);
				socketModules.chats.isDnD({ uid: fooUid }, herpUid, function (err, isDnD) {
					assert.ifError(err);
					assert(isDnD);
					done();
				});
			});
		});

		it('should fail to load recent chats with invalid data', function (done) {
			socketModules.chats.getRecentChats({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getRecentChats({ uid: fooUid }, { after: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.getRecentChats({ uid: fooUid }, { after: 0, uid: null }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should load recent chats of user', function (done) {
			socketModules.chats.getRecentChats({ uid: fooUid }, { after: 0, uid: fooUid }, function (err, data) {
				assert.ifError(err);
				assert(Array.isArray(data.rooms));
				done();
			});
		});

		it('should escape teaser', function (done) {
			socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: '<svg/onload=alert(document.location);' }, function (err) {
				assert.ifError(err);
				socketModules.chats.getRecentChats({ uid: fooUid }, { after: 0, uid: fooUid }, function (err, data) {
					assert.ifError(err);
					assert.equal(data.rooms[0].teaser.content, '&lt;svg&#x2F;onload=alert(document.location);');
					done();
				});
			});
		});

		it('should fail to check if user has private chat with invalid data', function (done) {
			socketModules.chats.hasPrivateChat({ uid: null }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.hasPrivateChat({ uid: fooUid }, null, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should check if user has private chat with another uid', function (done) {
			socketModules.chats.hasPrivateChat({ uid: fooUid }, herpUid, function (err, roomId) {
				assert.ifError(err);
				assert(roomId);
				done();
			});
		});
	});

	describe('edit/delete', function () {
		var socketModules = require('../src/socket.io/modules');
		var mid;
		before(function (done) {
			socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: 'first chat message' }, function (err, messageData) {
				assert.ifError(err);
				mid = messageData.mid;
				done();
			});
		});

		it('should fail to edit message with invalid data', function (done) {
			socketModules.chats.edit({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.edit({ uid: fooUid }, { roomId: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.edit({ uid: fooUid }, { roomId: 1, message: null }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should fail to edit message if new content is empty string', function (done) {
			socketModules.chats.edit({ uid: fooUid }, { mid: 5, roomId: roomId, message: ' ' }, function (err) {
				assert.equal(err.message, '[[error:invalid-chat-message]]');
				done();
			});
		});

		it('should fail to edit message if not own message', function (done) {
			socketModules.chats.edit({ uid: herpUid }, { mid: 5, roomId: roomId, message: 'message edited' }, function (err) {
				assert.equal(err.message, '[[error:cant-edit-chat-message]]');
				done();
			});
		});

		it('should edit message', function (done) {
			socketModules.chats.edit({ uid: fooUid }, { mid: mid, roomId: roomId, message: 'message edited' }, function (err) {
				assert.ifError(err);
				socketModules.chats.getRaw({ uid: fooUid }, { mid: mid }, function (err, raw) {
					assert.ifError(err);
					assert.equal(raw, 'message edited');
					done();
				});
			});
		});

		it('should fail to delete message with invalid data', function (done) {
			socketModules.chats.delete({ uid: fooUid }, null, function (err) {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.delete({ uid: fooUid }, { roomId: null }, function (err) {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.delete({ uid: fooUid }, { roomId: 1, messageId: null }, function (err) {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should fail to delete message if not owner', function (done) {
			socketModules.chats.delete({ uid: herpUid }, { messageId: mid, roomId: roomId }, function (err) {
				assert.equal(err.message, '[[error:cant-delete-chat-message]]');
				done();
			});
		});

		it('should mark the message as deleted', function (done) {
			socketModules.chats.delete({ uid: fooUid }, { messageId: mid, roomId: roomId }, function (err) {
				assert.ifError(err);
				db.getObjectField('message:' + mid, 'deleted', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(1, parseInt(value, 10));
					done();
				});
			});
		});

		it('should show deleted message to original users', function (done) {
			socketModules.chats.getMessages({ uid: fooUid }, { uid: fooUid, roomId: roomId, start: 0 }, function (err, messages) {
				assert.ifError(err);

				// Reduce messages to their mids
				var mids = messages.reduce(function (mids, cur) {
					mids.push(cur.messageId);
					return mids;
				}, []);

				assert(mids.includes(mid));
				done();
			});
		});

		it('should not show deleted message to other users', function (done) {
			socketModules.chats.getMessages({ uid: herpUid }, { uid: herpUid, roomId: roomId, start: 0 }, function (err, messages) {
				assert.ifError(err);

				// Reduce messages to their mids
				var mids = messages.reduce(function (mids, cur) {
					mids.push(cur.messageId);
					return mids;
				}, []);

				assert(!mids.includes(mid));
				done();
			});
		});

		it('should error out if a message is deleted again', function (done) {
			socketModules.chats.delete({ uid: fooUid }, { messageId: mid, roomId: roomId }, function (err) {
				assert.strictEqual('[[error:chat-deleted-already]]', err.message);
				done();
			});
		});

		it('should restore the message', function (done) {
			socketModules.chats.restore({ uid: fooUid }, { messageId: mid, roomId: roomId }, function (err) {
				assert.ifError(err);
				db.getObjectField('message:' + mid, 'deleted', function (err, value) {
					assert.ifError(err);
					assert.strictEqual(0, parseInt(value, 10));
					done();
				});
			});
		});

		it('should error out if a message is restored again', function (done) {
			socketModules.chats.restore({ uid: fooUid }, { messageId: mid, roomId: roomId }, function (err) {
				assert.strictEqual('[[error:chat-restored-already]]', err.message);
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

		it('should 500 for guest with no privilege error', function (done) {
			meta.config.disableChat = 0;
			request(nconf.get('url') + '/api/user/baz/chats', { json: true }, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 500);
				assert.equal(body.error, '[[error:no-privileges]]');
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
			request(nconf.get('url') + '/api/user/herp/chats', { json: true, jar: jar }, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(Array.isArray(body.rooms));
				assert.equal(body.rooms.length, 1);
				assert.equal(body.title, '[[pages:chats]]');
				done();
			});
		});

		it('should return room data', function (done) {
			request(nconf.get('url') + '/api/user/herp/chats/' + roomId, { json: true, jar: jar }, function (err, response, body) {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert.equal(body.roomId, roomId);
				assert.equal(body.isOwner, false);
				done();
			});
		});

		it('should redirect to chats page', function (done) {
			request(nconf.get('url') + '/api/chats', { jar: jar, json: true }, function (err, res, body) {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/user/herp/chats');
				assert.equal(body, '/user/herp/chats');
				done();
			});
		});

		it('should return 404 if user is not in room', function (done) {
			helpers.loginUser('baz', 'quuxquux', function (err, jar) {
				assert.ifError(err);
				request(nconf.get('url') + '/api/user/baz/chats/' + roomId, { json: true, jar: jar }, function (err, response) {
					assert.ifError(err);
					assert.equal(response.statusCode, 404);
					done();
				});
			});
		});
	});
});
