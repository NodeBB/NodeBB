'use strict';

const assert = require('assert');
const async = require('async');
const request = require('request');
const nconf = require('nconf');
const util = require('util');

const sleep = util.promisify(setTimeout);

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const User = require('../src/user');
const Groups = require('../src/groups');
const Messaging = require('../src/messaging');
const helpers = require('./helpers');
const socketModules = require('../src/socket.io/modules');

describe('Messaging Library', () => {
	let fooUid;	// the admin
	let bazUid;	// the user with chat restriction enabled
	let herpUid;
	let roomId;

	before((done) => {
		// Create 3 users: 1 admin, 2 regular
		async.series([
			async.apply(User.create, { username: 'foo', password: 'barbar' }),	// admin
			async.apply(User.create, { username: 'baz', password: 'quuxquux' }),	// restricted user
			async.apply(User.create, { username: 'herp', password: 'derpderp' }),	// regular user
		], (err, uids) => {
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

	describe('.canMessage()', () => {
		it('should allow messages to be sent to an unrestricted user', (done) => {
			Messaging.canMessageUser(bazUid, herpUid, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should NOT allow messages to be sent to a restricted user', (done) => {
			User.setSetting(bazUid, 'restrictChat', '1', (err) => {
				assert.ifError(err);
				Messaging.canMessageUser(herpUid, bazUid, (err) => {
					assert.strictEqual(err.message, '[[error:chat-restricted]]');
					socketModules.chats.addUserToRoom({ uid: herpUid }, { roomId: 1, username: 'baz' }, (err) => {
						assert.equal(err.message, '[[error:chat-restricted]]');
						done();
					});
				});
			});
		});

		it('should always allow admins through', (done) => {
			Messaging.canMessageUser(fooUid, bazUid, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should allow messages to be sent to a restricted user if restricted user follows sender', (done) => {
			User.follow(bazUid, herpUid, () => {
				Messaging.canMessageUser(herpUid, bazUid, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	describe('rooms', () => {
		it('should fail to create a new chat room with invalid data', (done) => {
			socketModules.chats.newRoom({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				done();
			});
		});

		it('should return rate limit error on second try', (done) => {
			const socketMock = { uid: fooUid };
			const oldValue = meta.config.chatMessageDelay;
			meta.config.chatMessageDelay = 1000;
			socketModules.chats.newRoom(socketMock, { touid: bazUid }, (err) => {
				assert.ifError(err);
				socketModules.chats.newRoom(socketMock, { touid: bazUid }, (err) => {
					assert.equal(err.message, '[[error:too-many-messages]]');
					meta.configs.chatMessageDelay = oldValue;
					done();
				});
			});
		});

		it('should create a new chat room', (done) => {
			socketModules.chats.newRoom({ uid: fooUid }, { touid: bazUid }, (err, _roomId) => {
				roomId = _roomId;
				assert.ifError(err);
				assert(roomId);
				socketModules.chats.canMessage({ uid: fooUid }, _roomId, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should send a user-join system message when a chat room is created', (done) => {
			socketModules.chats.getMessages({ uid: fooUid }, { uid: fooUid, roomId: roomId, start: 0 }, (err, messages) => {
				assert.ifError(err);
				assert.equal(messages.length, 2);
				assert.strictEqual(messages[0].system, true);
				assert.strictEqual(messages[0].content, 'user-join');
				socketModules.chats.edit({ uid: fooUid }, { roomId: roomId, mid: messages[0].messageId, message: 'test' }, (err) => {
					assert.equal(err.message, '[[error:cant-edit-chat-message]]');
					done();
				});
			});
		});

		it('should fail to add user to room with invalid data', (done) => {
			socketModules.chats.addUserToRoom({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should add a user to room', (done) => {
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'herp' }, (err) => {
				assert.ifError(err);
				Messaging.isUserInRoom(herpUid, roomId, (err, isInRoom) => {
					assert.ifError(err);
					assert(isInRoom);
					done();
				});
			});
		});

		it('should get users in room', async () => {
			const data = await socketModules.chats.getUsersInRoom({ uid: fooUid }, { roomId: roomId });
			assert(Array.isArray(data) && data.length === 3);
		});

		it('should throw error if user is not in room', async () => {
			try {
				const data = await socketModules.chats.getUsersInRoom({ uid: 123123123 }, { roomId: roomId });
			} catch (err) {
				assert.equal(err.message, '[[error:no-privileges]]');
			}
		});

		it('should fail to add users to room if max is reached', (done) => {
			meta.config.maximumUsersInChatRoom = 2;
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'test' }, (err) => {
				assert.equal(err.message, '[[error:cant-add-more-users-to-chat-room]]');
				meta.config.maximumUsersInChatRoom = 0;
				done();
			});
		});

		it('should fail to add users to room if user does not exist', (done) => {
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'doesnotexist' }, (err) => {
				assert.equal(err.message, '[[error:no-user]]');
				done();
			});
		});

		it('should fail to add self to room', (done) => {
			socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'foo' }, (err) => {
				assert.equal(err.message, '[[error:cant-chat-with-yourself]]');
				done();
			});
		});

		it('should fail to leave room with invalid data', (done) => {
			socketModules.chats.leave({ uid: null }, roomId, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.leave({ uid: fooUid }, null, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should leave the chat room', (done) => {
			socketModules.chats.leave({ uid: bazUid }, roomId, (err) => {
				assert.ifError(err);
				Messaging.isUserInRoom(bazUid, roomId, (err, isUserInRoom) => {
					assert.ifError(err);
					assert.equal(isUserInRoom, false);
					Messaging.getRoomData(roomId, (err, data) => {
						assert.ifError(err);
						assert.equal(data.owner, fooUid);
						done();
					});
				});
			});
		});

		it('should send a user-leave system message when a user leaves the chat room', (done) => {
			socketModules.chats.getMessages({ uid: fooUid }, { uid: fooUid, roomId: roomId, start: 0 }, (err, messages) => {
				assert.ifError(err);
				assert.equal(messages.length, 4);
				const message = messages.pop();
				assert.strictEqual(message.system, true);
				assert.strictEqual(message.content, 'user-leave');
				done();
			});
		});

		it('should send not a user-leave system message when a user tries to leave a room they are not in', async () => {
			await socketModules.chats.leave({ uid: bazUid }, roomId);
			const messages = await socketModules.chats.getMessages(
				{ uid: fooUid },
				{ uid: fooUid, roomId: roomId, start: 0 }
			);
			assert.equal(messages.length, 4);
			const message = messages.pop();
			assert.strictEqual(message.system, true);
			assert.strictEqual(message.content, 'user-leave');
		});

		it('should change owner when owner leaves room', (done) => {
			socketModules.chats.newRoom({ uid: herpUid }, { touid: fooUid }, (err, roomId) => {
				assert.ifError(err);
				socketModules.chats.addUserToRoom({ uid: herpUid }, { roomId: roomId, username: 'baz' }, (err) => {
					assert.ifError(err);
					socketModules.chats.leave({ uid: herpUid }, roomId, (err) => {
						assert.ifError(err);
						Messaging.getRoomData(roomId, (err, data) => {
							assert.ifError(err);
							assert.equal(data.owner, fooUid);
							done();
						});
					});
				});
			});
		});

		it('should change owner if owner is deleted', (done) => {
			User.create({ username: 'deleted_chat_user' }, (err, sender) => {
				assert.ifError(err);
				User.create({ username: 'receiver' }, (err, receiver) => {
					assert.ifError(err);
					socketModules.chats.newRoom({ uid: sender }, { touid: receiver }, (err, roomId) => {
						assert.ifError(err);
						User.deleteAccount(sender, (err) => {
							assert.ifError(err);
							Messaging.getRoomData(roomId, (err, data) => {
								assert.ifError(err);
								assert.equal(data.owner, receiver);
								done();
							});
						});
					});
				});
			});
		});

		it('should fail to remove user from room', (done) => {
			socketModules.chats.removeUserFromRoom({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.removeUserFromRoom({ uid: fooUid }, {}, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should fail to remove user from room if user does not exist', (done) => {
			socketModules.chats.removeUserFromRoom({ uid: fooUid }, { roomId: roomId, uid: 99 }, (err) => {
				assert.equal('[[error:no-user]]', err.message);
				done();
			});
		});

		it('should remove user from room', (done) => {
			socketModules.chats.newRoom({ uid: fooUid }, { touid: herpUid }, (err, roomId) => {
				assert.ifError(err);
				Messaging.isUserInRoom(herpUid, roomId, (err, isInRoom) => {
					assert.ifError(err);
					assert(isInRoom);
					socketModules.chats.removeUserFromRoom({ uid: fooUid }, { roomId: roomId, uid: herpUid }, (err) => {
						assert.equal(err.message, '[[error:cant-remove-last-user]]');
						socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'baz' }, (err) => {
							assert.ifError(err);
							socketModules.chats.removeUserFromRoom({ uid: fooUid }, { roomId: roomId, uid: herpUid }, (err) => {
								assert.ifError(err);
								Messaging.isUserInRoom(herpUid, roomId, (err, isInRoom) => {
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

		it('should fail to send a message to room with invalid data', (done) => {
			socketModules.chats.send({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.send({ uid: fooUid }, { roomId: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.send({ uid: null }, { roomId: 1 }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should fail to send chat if content is empty', (done) => {
			socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: ' ' }, (err) => {
				assert.equal(err.message, '[[error:invalid-chat-message]]');
				done();
			});
		});

		it('should send a message to a room', (done) => {
			socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: 'first chat message' }, (err, messageData) => {
				assert.ifError(err);
				assert(messageData);
				assert.equal(messageData.content, 'first chat message');
				assert(messageData.fromUser);
				assert(messageData.roomId, roomId);
				socketModules.chats.getRaw({ uid: fooUid }, { mid: messageData.mid }, (err, raw) => {
					assert.ifError(err);
					assert.equal(raw, 'first chat message');
					setTimeout(done, 300);
				});
			});
		});

		it('should fail to send second message due to rate limit', (done) => {
			const socketMock = { uid: fooUid };
			const oldValue = meta.config.chatMessageDelay;
			meta.config.chatMessageDelay = 1000;
			socketModules.chats.send(socketMock, { roomId: roomId, message: 'first chat message' }, (err) => {
				assert.ifError(err);
				socketModules.chats.send(socketMock, { roomId: roomId, message: 'first chat message' }, (err) => {
					assert.equal(err.message, '[[error:too-many-messages]]');
					meta.config.chatMessageDelay = oldValue;
					done();
				});
			});
		});

		it('should return invalid-data error', (done) => {
			socketModules.chats.getRaw({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getRaw({ uid: fooUid }, {}, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should return not allowed error if mid is not in room', (done) => {
			let myRoomId;
			User.create({ username: 'dummy' }, (err, uid) => {
				assert.ifError(err);
				socketModules.chats.newRoom({ uid: bazUid }, { touid: uid }, (err, _roomId) => {
					myRoomId = _roomId;
					assert.ifError(err);
					assert(myRoomId);
					socketModules.chats.getRaw({ uid: bazUid }, { mid: 200 }, (err) => {
						assert(err);
						assert.equal(err.message, '[[error:not-allowed]]');
						socketModules.chats.send({ uid: bazUid }, { roomId: myRoomId, message: 'admin will see this' }, (err, message) => {
							assert.ifError(err);
							socketModules.chats.getRaw({ uid: fooUid }, { mid: message.mid }, (err, raw) => {
								assert.ifError(err);
								assert.equal(raw, 'admin will see this');
								done();
							});
						});
					});
				});
			});
		});


		it('should notify offline users of message', async () => {
			meta.config.notificationSendDelay = 0.1;

			const roomId = await socketModules.chats.newRoom({ uid: fooUid }, { touid: bazUid });
			assert(roomId);
			await socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'herp' });
			await db.sortedSetAdd('users:online', Date.now() - ((meta.config.onlineCutoff * 60000) + 50000), herpUid);
			await socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: 'second chat message **bold** text' });

			await sleep(1500);
			const data = await User.notifications.get(herpUid);
			assert(data.unread[0]);
			const notification = data.unread[0];
			assert.strictEqual(notification.bodyShort, '[[notifications:new_message_from, foo]]');
			assert.strictEqual(notification.nid, `chat_${fooUid}_${roomId}`);
			assert.strictEqual(notification.path, `${nconf.get('relative_path')}/chats/${roomId}`);
		});

		it('should fail to get messages from room with invalid data', (done) => {
			socketModules.chats.getMessages({ uid: null }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getMessages({ uid: fooUid }, null, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.getMessages({ uid: fooUid }, { uid: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						socketModules.chats.getMessages({ uid: fooUid }, { uid: 1, roomId: null }, (err) => {
							assert.equal(err.message, '[[error:invalid-data]]');
							done();
						});
					});
				});
			});
		});

		it('should get messages from room', (done) => {
			socketModules.chats.getMessages({ uid: fooUid }, {
				uid: fooUid,
				roomId: roomId,
				start: 0,
			}, (err, messages) => {
				assert.ifError(err);
				assert(Array.isArray(messages));
				assert.equal(messages[4].roomId, roomId);
				assert.equal(messages[4].fromuid, fooUid);
				done();
			});
		});

		it('should fail to mark read with invalid data', (done) => {
			socketModules.chats.markRead({ uid: null }, roomId, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.markRead({ uid: fooUid }, null, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should not error if user is not in room', (done) => {
			socketModules.chats.markRead({ uid: herpUid }, 10, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should mark room read', (done) => {
			socketModules.chats.markRead({ uid: fooUid }, roomId, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should mark all rooms read', (done) => {
			socketModules.chats.markAllRead({ uid: fooUid }, {}, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should fail to rename room with invalid data', (done) => {
			socketModules.chats.renameRoom({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.renameRoom({ uid: fooUid }, { roomId: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.renameRoom({ uid: fooUid }, { roomId: roomId, newName: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should rename room', (done) => {
			socketModules.chats.renameRoom({ uid: fooUid }, { roomId: roomId, newName: 'new room name' }, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should send a room-rename system message when a room is renamed', (done) => {
			socketModules.chats.getMessages({ uid: fooUid }, { uid: fooUid, roomId: roomId, start: 0 }, (err, messages) => {
				assert.ifError(err);
				const message = messages.pop();
				assert.strictEqual(message.system, true);
				assert.strictEqual(message.content, 'room-rename, new room name');
				done();
			});
		});

		it('should fail to load room with invalid-data', (done) => {
			socketModules.chats.loadRoom({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.loadRoom({ uid: fooUid }, { roomId: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should fail to load room if user is not in', (done) => {
			socketModules.chats.loadRoom({ uid: 0 }, { roomId: roomId }, (err) => {
				assert.equal(err.message, '[[error:no-privileges]]');
				done();
			});
		});

		it('should load chat room', (done) => {
			socketModules.chats.loadRoom({ uid: fooUid }, { roomId: roomId }, (err, data) => {
				assert.ifError(err);
				assert(data);
				assert.equal(data.roomName, 'new room name');
				done();
			});
		});

		it('should return true if user is dnd', (done) => {
			db.setObjectField(`user:${herpUid}`, 'status', 'dnd', (err) => {
				assert.ifError(err);
				socketModules.chats.isDnD({ uid: fooUid }, herpUid, (err, isDnD) => {
					assert.ifError(err);
					assert(isDnD);
					done();
				});
			});
		});

		it('should fail to load recent chats with invalid data', (done) => {
			socketModules.chats.getRecentChats({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getRecentChats({ uid: fooUid }, { after: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.getRecentChats({ uid: fooUid }, { after: 0, uid: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should load recent chats of user', (done) => {
			socketModules.chats.getRecentChats({ uid: fooUid }, { after: 0, uid: fooUid }, (err, data) => {
				assert.ifError(err);
				assert(Array.isArray(data.rooms));
				done();
			});
		});

		it('should escape teaser', (done) => {
			socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: '<svg/onload=alert(document.location);' }, (err) => {
				assert.ifError(err);
				socketModules.chats.getRecentChats({ uid: fooUid }, { after: 0, uid: fooUid }, (err, data) => {
					assert.ifError(err);
					assert.equal(data.rooms[0].teaser.content, '&lt;svg&#x2F;onload=alert(document.location);');
					done();
				});
			});
		});

		it('should fail to check if user has private chat with invalid data', (done) => {
			socketModules.chats.hasPrivateChat({ uid: null }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.hasPrivateChat({ uid: fooUid }, null, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should check if user has private chat with another uid', (done) => {
			socketModules.chats.hasPrivateChat({ uid: fooUid }, herpUid, (err, roomId) => {
				assert.ifError(err);
				assert(roomId);
				done();
			});
		});
	});

	describe('edit/delete', () => {
		const socketModules = require('../src/socket.io/modules');
		let mid;
		let mid2;
		before(async () => {
			await socketModules.chats.addUserToRoom({ uid: fooUid }, { roomId: roomId, username: 'baz' });
			mid = (await socketModules.chats.send({ uid: fooUid }, { roomId: roomId, message: 'first chat message' })).mid;
			mid2 = (await socketModules.chats.send({ uid: bazUid }, { roomId: roomId, message: 'second chat message' })).mid;
		});

		after(async () => {
			await socketModules.chats.leave({ uid: bazUid }, roomId);
		});

		it('should fail to edit message with invalid data', (done) => {
			socketModules.chats.edit({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.edit({ uid: fooUid }, { roomId: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.edit({ uid: fooUid }, { roomId: 1, message: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should fail to edit message if new content is empty string', (done) => {
			socketModules.chats.edit({ uid: fooUid }, { mid: mid, roomId: roomId, message: ' ' }, (err) => {
				assert.equal(err.message, '[[error:invalid-chat-message]]');
				done();
			});
		});

		it('should fail to edit message if not own message', (done) => {
			socketModules.chats.edit({ uid: herpUid }, { mid: mid, roomId: roomId, message: 'message edited' }, (err) => {
				assert.equal(err.message, '[[error:cant-edit-chat-message]]');
				done();
			});
		});

		it('should edit message', (done) => {
			socketModules.chats.edit({ uid: fooUid }, { mid: mid, roomId: roomId, message: 'message edited' }, (err) => {
				assert.ifError(err);
				socketModules.chats.getRaw({ uid: fooUid }, { mid: mid }, (err, raw) => {
					assert.ifError(err);
					assert.equal(raw, 'message edited');
					done();
				});
			});
		});

		it('should fail to delete message with invalid data', (done) => {
			socketModules.chats.delete({ uid: fooUid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.delete({ uid: fooUid }, { roomId: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.delete({ uid: fooUid }, { roomId: 1, messageId: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should fail to delete message if not owner', (done) => {
			socketModules.chats.delete({ uid: herpUid }, { messageId: mid, roomId: roomId }, (err) => {
				assert.equal(err.message, '[[error:cant-delete-chat-message]]');
				done();
			});
		});

		it('should mark the message as deleted', (done) => {
			socketModules.chats.delete({ uid: fooUid }, { messageId: mid, roomId: roomId }, (err) => {
				assert.ifError(err);
				db.getObjectField(`message:${mid}`, 'deleted', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(1, parseInt(value, 10));
					done();
				});
			});
		});

		it('should show deleted message to original users', (done) => {
			socketModules.chats.getMessages({ uid: fooUid }, { uid: fooUid, roomId: roomId, start: 0 }, (err, messages) => {
				assert.ifError(err);

				// Reduce messages to their mids
				const mids = messages.reduce((mids, cur) => {
					mids.push(cur.messageId);
					return mids;
				}, []);

				assert(mids.includes(mid));
				done();
			});
		});

		it('should not show deleted message to other users', (done) => {
			socketModules.chats.getMessages({ uid: herpUid }, { uid: herpUid, roomId: roomId, start: 0 }, (err, messages) => {
				assert.ifError(err);
				messages.forEach((msg) => {
					assert(!msg.deleted || msg.content === '[[modules:chat.message-deleted]]', msg.content);
				});
				done();
			});
		});

		it('should error out if a message is deleted again', (done) => {
			socketModules.chats.delete({ uid: fooUid }, { messageId: mid, roomId: roomId }, (err) => {
				assert.strictEqual('[[error:chat-deleted-already]]', err.message);
				done();
			});
		});

		it('should restore the message', (done) => {
			socketModules.chats.restore({ uid: fooUid }, { messageId: mid, roomId: roomId }, (err) => {
				assert.ifError(err);
				db.getObjectField(`message:${mid}`, 'deleted', (err, value) => {
					assert.ifError(err);
					assert.strictEqual(0, parseInt(value, 10));
					done();
				});
			});
		});

		it('should error out if a message is restored again', (done) => {
			socketModules.chats.restore({ uid: fooUid }, { messageId: mid, roomId: roomId }, (err) => {
				assert.strictEqual('[[error:chat-restored-already]]', err.message);
				done();
			});
		});

		describe('disabled via ACP', () => {
			before(async () => {
				meta.config.disableChatMessageEditing = true;
			});

			after(async () => {
				meta.config.disableChatMessageEditing = false;
			});

			it('should error out for regular users', async () => {
				try {
					await socketModules.chats.delete({ uid: bazUid }, { messageId: mid2, roomId: roomId });
				} catch (err) {
					assert.strictEqual('[[error:chat-message-editing-disabled]]', err.message);
				}
			});

			it('should succeed for administrators', async () => {
				await socketModules.chats.delete({ uid: fooUid }, { messageId: mid2, roomId: roomId });
				await socketModules.chats.restore({ uid: fooUid }, { messageId: mid2, roomId: roomId });
			});

			it('should succeed for global moderators', async () => {
				await Groups.join(['Global Moderators'], bazUid);

				await socketModules.chats.delete({ uid: fooUid }, { messageId: mid2, roomId: roomId });
				await socketModules.chats.restore({ uid: fooUid }, { messageId: mid2, roomId: roomId });

				await Groups.leave(['Global Moderators'], bazUid);
			});
		});
	});

	describe('controller', () => {
		it('should 404 if chat is disabled', (done) => {
			meta.config.disableChat = 1;
			request(`${nconf.get('url')}/user/baz/chats`, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});

		it('should 500 for guest with no privilege error', (done) => {
			meta.config.disableChat = 0;
			request(`${nconf.get('url')}/api/user/baz/chats`, { json: true }, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 500);
				assert.equal(body.error, '[[error:no-privileges]]');
				done();
			});
		});

		it('should 404 for non-existent user', (done) => {
			request(`${nconf.get('url')}/user/doesntexist/chats`, (err, response) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 404);
				done();
			});
		});
	});

	describe('logged in chat controller', () => {
		let jar;
		before((done) => {
			helpers.loginUser('herp', 'derpderp', (err, _jar) => {
				assert.ifError(err);
				jar = _jar;
				done();
			});
		});

		it('should return chats page data', (done) => {
			request(`${nconf.get('url')}/api/user/herp/chats`, { json: true, jar: jar }, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert(Array.isArray(body.rooms));
				assert.equal(body.rooms.length, 2);
				assert.equal(body.title, '[[pages:chats]]');
				done();
			});
		});

		it('should return room data', (done) => {
			request(`${nconf.get('url')}/api/user/herp/chats/${roomId}`, { json: true, jar: jar }, (err, response, body) => {
				assert.ifError(err);
				assert.equal(response.statusCode, 200);
				assert.equal(body.roomId, roomId);
				assert.equal(body.isOwner, false);
				done();
			});
		});

		it('should redirect to chats page', (done) => {
			request(`${nconf.get('url')}/api/chats`, { jar: jar, json: true }, (err, res, body) => {
				assert.ifError(err);
				assert.equal(res.statusCode, 200);
				assert.equal(res.headers['x-redirect'], '/user/herp/chats');
				assert.equal(body, '/user/herp/chats');
				done();
			});
		});

		it('should return 404 if user is not in room', (done) => {
			helpers.loginUser('baz', 'quuxquux', (err, jar) => {
				assert.ifError(err);
				request(`${nconf.get('url')}/api/user/baz/chats/${roomId}`, { json: true, jar: jar }, (err, response) => {
					assert.ifError(err);
					assert.equal(response.statusCode, 404);
					done();
				});
			});
		});
	});
});
