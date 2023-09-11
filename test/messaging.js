'use strict';

const assert = require('assert');
const request = require('request-promise-native');
const nconf = require('nconf');
const util = require('util');

const sleep = util.promisify(setTimeout);

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const User = require('../src/user');
const Groups = require('../src/groups');
const Messaging = require('../src/messaging');
const api = require('../src/api');
const helpers = require('./helpers');
const socketModules = require('../src/socket.io/modules');
const utils = require('../src/utils');
const translator = require('../src/translator');

describe('Messaging Library', () => {
	const mocks = {
		users: {
			foo: {}, // the admin
			bar: {},
			baz: {}, // the user with chat restriction enabled
			herp: {},
		},
	};
	let roomId;

	let chatMessageDelay;

	const callv3API = async (method, path, body, user) => {
		const options = {
			method,
			body,
			json: true,
			jar: mocks.users[user].jar,
			resolveWithFullResponse: true,
			simple: false,
		};

		if (method !== 'get') {
			options.headers = {
				'x-csrf-token': mocks.users[user].csrf,
			};
		}

		return request(`${nconf.get('url')}/api/v3${path}`, options);
	};

	before(async () => {
		// Create 3 users: 1 admin, 2 regular
		({
			foo: mocks.users.foo.uid,
			bar: mocks.users.bar.uid,
			baz: mocks.users.baz.uid,
			herp: mocks.users.herp.uid,
		} = await utils.promiseParallel({
			foo: User.create({ username: 'foo', password: 'barbar' }), // admin
			bar: User.create({ username: 'bar', password: 'bazbaz' }), // admin
			baz: User.create({ username: 'baz', password: 'quuxquux' }), // restricted user
			herp: User.create({ username: 'herp', password: 'derpderp' }), // a regular user
		}));

		await Groups.join('administrators', mocks.users.foo.uid);
		await User.setSetting(mocks.users.baz.uid, 'restrictChat', '1');

		({ jar: mocks.users.foo.jar, csrf_token: mocks.users.foo.csrf } = await helpers.loginUser('foo', 'barbar'));
		({ jar: mocks.users.bar.jar, csrf_token: mocks.users.bar.csrf } = await helpers.loginUser('bar', 'bazbaz'));
		({ jar: mocks.users.baz.jar, csrf_token: mocks.users.baz.csrf } = await helpers.loginUser('baz', 'quuxquux'));
		({ jar: mocks.users.herp.jar, csrf_token: mocks.users.herp.csrf } = await helpers.loginUser('herp', 'derpderp'));

		chatMessageDelay = meta.config.chatMessageDelay;
		meta.config.chatMessageDelay = 0;
	});

	after(() => {
		meta.configs.chatMessageDelay = chatMessageDelay;
	});

	describe('.canMessage()', () => {
		it('should allow messages to be sent to an unrestricted user', (done) => {
			Messaging.canMessageUser(mocks.users.baz.uid, mocks.users.herp.uid, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should NOT allow messages to be sent to a restricted user', async () => {
			await User.setSetting(mocks.users.baz.uid, 'restrictChat', '1');
			try {
				await Messaging.canMessageUser(mocks.users.herp.uid, mocks.users.baz.uid);
			} catch (err) {
				assert.strictEqual(err.message, '[[error:chat-restricted]]');
			}
		});

		it('should always allow admins through', (done) => {
			Messaging.canMessageUser(mocks.users.foo.uid, mocks.users.baz.uid, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should allow messages to be sent to a restricted user if restricted user follows sender', (done) => {
			User.follow(mocks.users.baz.uid, mocks.users.herp.uid, () => {
				Messaging.canMessageUser(mocks.users.herp.uid, mocks.users.baz.uid, (err) => {
					assert.ifError(err);
					done();
				});
			});
		});

		it('should not allow messaging room if user is muted', async () => {
			const twoMinutesFromNow = Date.now() + (2 * 60 * 1000);
			const twoHoursFromNow = Date.now() + (2 * 60 * 60 * 1000);
			const roomId = 0;

			await User.setUserField(mocks.users.herp.uid, 'mutedUntil', twoMinutesFromNow);
			await assert.rejects(Messaging.canMessageRoom(mocks.users.herp.uid, roomId), (err) => {
				assert(err.message.startsWith('[[error:user-muted-for-minutes,'));
				return true;
			});

			await User.setUserField(mocks.users.herp.uid, 'mutedUntil', twoHoursFromNow);
			await assert.rejects(Messaging.canMessageRoom(mocks.users.herp.uid, roomId), (err) => {
				assert(err.message.startsWith('[[error:user-muted-for-hours,'));
				return true;
			});
			await db.deleteObjectField(`user:${mocks.users.herp.uid}`, 'mutedUntil');
			await assert.rejects(Messaging.canMessageRoom(mocks.users.herp.uid, roomId), {
				message: '[[error:no-room]]',
			});
		});
	});

	describe('rooms', () => {
		it('should fail to create a new chat room with invalid data', async () => {
			const { body } = await callv3API('post', '/chats', {}, 'foo');
			assert.equal(body.status.message, await translator.translate('[[error:required-parameters-missing, uids]]'));
		});

		it('should return rate limit error on second try', async () => {
			const oldValue = meta.config.chatMessageDelay;
			meta.config.chatMessageDelay = 1000;

			await callv3API('post', '/chats', {
				uids: [mocks.users.baz.uid],
			}, 'foo');

			const { statusCode, body } = await callv3API('post', `/chats`, {
				uids: [mocks.users.baz.uid],
			}, 'foo');

			assert.equal(statusCode, 400);
			assert.equal(body.status.code, 'bad-request');
			assert.equal(body.status.message, await translator.translate('[[error:too-many-messages]]'));
			meta.config.chatMessageDelay = oldValue;
		});

		it('should create a new chat room', async () => {
			await User.setSetting(mocks.users.baz.uid, 'restrictChat', '0');
			const { body } = await callv3API('post', `/chats`, {
				uids: [mocks.users.baz.uid],
			}, 'foo');
			await User.setSetting(mocks.users.baz.uid, 'restrictChat', '1');

			roomId = body.response.roomId;
			assert(roomId);
		});

		it('should send a user-join system message when a chat room is created', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			const { messages } = body.response;
			assert.equal(messages.length, 2);
			assert.strictEqual(messages[0].system, 1);
			assert.strictEqual(messages[0].content, 'user-join');

			const { statusCode, body: body2 } = await callv3API('put', `/chats/${roomId}/messages/${messages[0].messageId}`, {
				message: 'test',
			}, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.equal(body2.status.message, await translator.translate('[[error:cant-edit-chat-message]]'));
		});

		it('should fail to add user to room with invalid data', async () => {
			let { statusCode, body } = await callv3API('post', `/chats/${roomId}/users`, {}, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:required-parameters-missing, uids]]'));

			({ statusCode, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [null] }, 'foo'));
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should add a user to room', async () => {
			await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.herp.uid] }, 'foo');
			const isInRoom = await Messaging.isUserInRoom(mocks.users.herp.uid, roomId);
			assert(isInRoom);
		});

		it('should get users in room', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}/users`, {}, 'foo');
			assert(Array.isArray(body.response.users));
			assert.strictEqual(body.response.users.length, 3);
		});

		it('should throw error if user is not in room', async () => {
			const { statusCode, body } = await callv3API('get', `/chats/${roomId}/users`, {}, 'bar');
			assert.strictEqual(statusCode, 403);
			assert.equal(body.status.message, await translator.translate('[[error:no-privileges]]'));
		});

		it('should fail to add users to room if max is reached', async () => {
			meta.config.maximumUsersInChatRoom = 2;
			const { statusCode, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.bar.uid] }, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.equal(body.status.message, await translator.translate('[[error:cant-add-more-users-to-chat-room]]'));
			meta.config.maximumUsersInChatRoom = 0;
		});

		it('should fail to add users to room if user does not exist', async () => {
			const { statusCode, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [98237498234] }, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should fail to add self to room', async () => {
			const { statusCode, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.foo.uid] }, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:cant-chat-with-yourself]]'));
		});

		it('should fail to leave room with invalid data', async () => {
			let { statusCode, body } = await callv3API('delete', `/chats/${roomId}/users`, {}, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:required-parameters-missing, uids]]'));

			({ statusCode, body } = await callv3API('delete', `/chats/${roomId}/users`, { uids: [98237423] }, 'foo'));
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should leave the chat room', async () => {
			await callv3API('delete', `/chats/${roomId}/users/${mocks.users.baz.uid}`, {}, 'baz');
			const isUserInRoom = await Messaging.isUserInRoom(mocks.users.baz.uid, roomId);
			assert.equal(isUserInRoom, false);
			assert(await Messaging.isRoomOwner(mocks.users.foo.uid, roomId));
		});

		it('should send a user-leave system message when a user leaves the chat room', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			const { messages } = body.response;
			const message = messages.pop();
			assert.strictEqual(message.system, 1);
			assert.strictEqual(message.content, 'user-leave');
		});

		it('should not send a user-leave system message when a user tries to leave a room they are not in', async () => {
			await callv3API('delete', `/chats/${roomId}/users/${mocks.users.baz.uid}`, {}, 'baz');
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			const { messages } = body.response;

			assert.equal(messages.length, 4);
			let message = messages.pop();
			assert.strictEqual(message.system, 1);
			assert.strictEqual(message.content, 'user-leave');

			// The message before should still be a user-join
			message = messages.pop();
			assert.strictEqual(message.system, 1);
			assert.strictEqual(message.content, 'user-join');
		});

		it('should change owner when owner leaves room', async () => {
			const { body } = await callv3API('post', '/chats', {
				uids: [mocks.users.foo.uid],
			}, 'herp');

			await callv3API('post', `/chats/${body.response.roomId}/users`, { uids: [mocks.users.baz.uid] }, 'herp');

			await callv3API('delete', `/chats/${body.response.roomId}/users/${mocks.users.herp.uid}`, {}, 'herp');

			assert(await Messaging.isRoomOwner(mocks.users.foo.uid, roomId));
		});

		it('should change owner if owner is deleted', async () => {
			const sender = await User.create({ username: 'deleted_chat_user', password: 'barbar' });
			const { jar: senderJar, csrf_token: senderCsrf } = await helpers.loginUser('deleted_chat_user', 'barbar');

			const receiver = await User.create({ username: 'receiver' });
			const { response } = await request(`${nconf.get('url')}/api/v3/chats`, {
				method: 'post',
				json: true,
				jar: senderJar,
				body: {
					uids: [receiver],
				},
				headers: {
					'x-csrf-token': senderCsrf,
				},
			});
			await User.deleteAccount(sender);
			assert(await Messaging.isRoomOwner(receiver, response.roomId));
		});

		it('should fail to remove user from room', async () => {
			let { statusCode, body } = await callv3API('delete', `/chats/${roomId}/users`, {}, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:required-parameters-missing, uids]]'));

			({ statusCode, body } = await callv3API('delete', `/chats/${roomId}/users`, { uids: [null] }, 'foo'));
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should fail to remove user from room if user does not exist', async () => {
			const { statusCode, body } = await callv3API('delete', `/chats/${roomId}/users`, { uids: [99] }, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should remove user from room', async () => {
			const { statusCode, body } = await callv3API('post', `/chats`, {
				uids: [mocks.users.herp.uid],
			}, 'foo');
			const { roomId } = body.response;
			assert.strictEqual(statusCode, 200);

			let isInRoom = await Messaging.isUserInRoom(mocks.users.herp.uid, roomId);
			assert(isInRoom);

			await callv3API('delete', `/chats/${roomId}/users`, { uids: [mocks.users.herp.uid] }, 'foo');
			isInRoom = await Messaging.isUserInRoom(mocks.users.herp.uid, roomId);
			assert(!isInRoom);
		});

		it('should fail to send a message to room with invalid data', async () => {
			let { body } = await callv3API('post', `/chats/abc`, { message: 'test' }, 'foo');
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-data]]'));

			({ body } = await callv3API('post', `/chats/1`, {}, 'foo'));
			assert.strictEqual(body.status.message, await translator.translate('[[error:required-parameters-missing, message]]'));
		});

		it('should fail to send chat if content is empty', async () => {
			const { body } = await callv3API('post', `/chats/${roomId}`, {
				message: ' ',
			}, 'foo');
			const { status, response } = body;

			assert.deepStrictEqual(response, {});
			assert.equal(status.message, await translator.translate('[[error:invalid-chat-message]]'));
		});

		it('should send a message to a room', async () => {
			const { body } = await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: 'first chat message' }, 'foo');
			const messageData = body.response;
			assert(messageData);
			assert.equal(messageData.content, 'first chat message');
			assert(messageData.fromUser);
			assert(messageData.roomId, roomId);
			const raw =
				await util.promisify(socketModules.chats.getRaw)({ uid: mocks.users.foo.uid }, { mid: messageData.messageId });
			assert.equal(raw, 'first chat message');
		});

		it('should fail to send second message due to rate limit', async () => {
			const oldValue = meta.config.chatMessageDelay;
			meta.config.chatMessageDelay = 1000;

			await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: 'first chat message' }, 'foo');
			const { body } = await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: 'first chat message' }, 'foo');
			const { status } = body;
			assert.equal(status.message, await translator.translate('[[error:too-many-messages]]'));
			meta.config.chatMessageDelay = oldValue;
		});

		it('should return invalid-data error', (done) => {
			socketModules.chats.getRaw({ uid: mocks.users.foo.uid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getRaw({ uid: mocks.users.foo.uid }, {}, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should return not allowed error if mid is not in room', async () => {
			const uids = await User.create({ username: 'dummy' });
			let { body } = await callv3API('post', '/chats', { uids: [uids] }, 'baz');
			const myRoomId = body.response.roomId;
			assert(myRoomId);

			try {
				await socketModules.chats.getRaw({ uid: mocks.users.baz.uid }, { mid: 200 });
			} catch (err) {
				assert(err);
				assert.equal(err.message, '[[error:not-allowed]]');
			}

			({ body } = await callv3API('post', `/chats/${myRoomId}`, { roomId: myRoomId, message: 'admin will see this' }, 'baz'));
			const message = body.response;
			const raw = await socketModules.chats.getRaw({ uid: mocks.users.foo.uid }, { mid: message.messageId });
			assert.equal(raw, 'admin will see this');
		});


		it('should notify offline users of message', async () => {
			meta.config.notificationSendDelay = 0.1;

			const { body } = await callv3API('post', '/chats', { uids: [mocks.users.baz.uid] }, 'foo');
			const { roomId } = body.response;
			assert(roomId);

			await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.herp.uid] }, 'foo');
			await db.sortedSetAdd('users:online', Date.now() - ((meta.config.onlineCutoff * 60000) + 50000), mocks.users.herp.uid);

			await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: 'second chat message **bold** text' }, 'foo');
			await sleep(3000);
			const data = await User.notifications.get(mocks.users.herp.uid);
			assert(data.unread[0]);
			const notification = data.unread[0];
			assert.strictEqual(notification.bodyShort, 'New message from <strong>foo</strong>');
			assert.strictEqual(notification.nid, `chat_${roomId}_${mocks.users.foo.uid}`);
			assert.strictEqual(notification.path, `${nconf.get('relative_path')}/chats/${roomId}`);
		});

		it('should get messages from room', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			const { messages } = body.response;
			assert(Array.isArray(messages));

			// Filter out system messages
			const normalMessages = messages.filter(message => !message.system);
			assert.equal(normalMessages[0].roomId, roomId);
			assert.equal(normalMessages[0].fromuid, mocks.users.foo.uid);
		});

		it('should fail to mark read with invalid data', async () => {
			let _err;
			try {
				await api.chats.mark({ uid: null }, { state: 0, roomId });
			} catch (err) {
				_err = err;
			}
			assert.strictEqual(_err.message, '[[error:invalid-data]]');

			try {
				await api.chats.mark({ uid: mocks.users.foo.uid }, null);
			} catch (err) {
				_err = err;
			}
			assert.strictEqual(_err.message, '[[error:invalid-data]]');
		});

		it('should not error if user is not in room', async () => {
			await api.chats.mark({ uid: mocks.users.herp.uid }, { state: 0, roomId: 10 });
		});

		it('should mark room read', async () => {
			await api.chats.mark({ uid: mocks.users.foo.uid }, { state: 0, roomId: roomId });
		});

		it('should mark all rooms read', (done) => {
			socketModules.chats.markAllRead({ uid: mocks.users.foo.uid }, {}, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should fail to rename room with invalid data', async () => {
			const { body } = await callv3API('put', `/chats/${roomId}`, { name: null }, 'foo');
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-data]]'));
		});

		it('should rename room', async () => {
			const { statusCode } = await callv3API('put', `/chats/${roomId}`, { name: 'new room name' }, 'foo');
			assert.strictEqual(statusCode, 200);
		});

		it('should send a room-rename system message when a room is renamed', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			const { messages } = body.response;

			const message = messages.pop();
			assert.strictEqual(message.system, 1);
			assert.strictEqual(message.content, 'room-rename, new room name');
		});

		it('should fail to load room with invalid-data', async () => {
			const { body } = await callv3API('get', `/chats/abc`, {}, 'foo');
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-data]]'));
		});

		it('should fail to load room if user is not in', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'baz');
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-privileges]]'));
		});

		it('should load chat room', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			assert.strictEqual(body.response.roomName, 'new room name');
		});

		it('should return true if user is dnd', (done) => {
			db.setObjectField(`user:${mocks.users.herp.uid}`, 'status', 'dnd', (err) => {
				assert.ifError(err);
				socketModules.chats.isDnD({ uid: mocks.users.foo.uid }, mocks.users.herp.uid, (err, isDnD) => {
					assert.ifError(err);
					assert(isDnD);
					done();
				});
			});
		});

		it('should fail to load recent chats with invalid data', (done) => {
			socketModules.chats.getRecentChats({ uid: mocks.users.foo.uid }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.getRecentChats({ uid: mocks.users.foo.uid }, { after: null }, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					socketModules.chats.getRecentChats({ uid: mocks.users.foo.uid }, { after: 0, uid: null }, (err) => {
						assert.equal(err.message, '[[error:invalid-data]]');
						done();
					});
				});
			});
		});

		it('should load recent chats of user', (done) => {
			socketModules.chats.getRecentChats(
				{ uid: mocks.users.foo.uid },
				{ after: 0, uid: mocks.users.foo.uid },
				(err, data) => {
					assert.ifError(err);
					assert(Array.isArray(data.rooms));
					done();
				}
			);
		});

		it('should escape teaser', async () => {
			await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: '<svg/onload=alert(document.location);' }, 'foo');
			const data = await util.promisify(socketModules.chats.getRecentChats)(
				{ uid: mocks.users.foo.uid },
				{ after: 0, uid: mocks.users.foo.uid }
			);

			assert.equal(data.rooms[0].teaser.content, '&lt;svg&#x2F;onload=alert(document.location);');
		});

		it('should fail to check if user has private chat with invalid data', (done) => {
			socketModules.chats.hasPrivateChat({ uid: null }, null, (err) => {
				assert.equal(err.message, '[[error:invalid-data]]');
				socketModules.chats.hasPrivateChat({ uid: mocks.users.foo.uid }, null, (err) => {
					assert.equal(err.message, '[[error:invalid-data]]');
					done();
				});
			});
		});

		it('should check if user has private chat with another uid', (done) => {
			socketModules.chats.hasPrivateChat({ uid: mocks.users.foo.uid }, mocks.users.herp.uid, (err, roomId) => {
				assert.ifError(err);
				assert(roomId);
				done();
			});
		});
	});

	describe('toMid', () => {
		let roomId;
		let firstMid;
		before(async () => {
			// create room
			const { body } = await callv3API('post', `/chats`, {
				uids: [mocks.users.bar.uid],
			}, 'foo');
			roomId = body.response.roomId;
			// send message
			const result = await callv3API('post', `/chats/${roomId}`, {
				roomId: roomId,
				message: 'first chat message',
			}, 'foo');

			firstMid = result.body.response.mid;
		});

		it('should fail if toMid is not a number', async () => {
			const result = await callv3API('post', `/chats/${roomId}`, {
				roomId: roomId,
				message: 'invalid',
				toMid: 'osmaosd',
			}, 'foo');
			assert.strictEqual(result.body.status.message, 'Invalid Chat Message ID');
		});

		it('should reply to firstMid using toMid', async () => {
			const { body } = await callv3API('post', `/chats/${roomId}`, {
				roomId: roomId,
				message: 'invalid',
				toMid: firstMid,
			}, 'bar');
			assert(body.response.mid);
		});

		it('should fail if user can not view toMid', async () => {
			// add new user
			await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.herp.uid] }, 'foo');
			// try to reply to firstMid that this user cant see
			const { body } = await callv3API('post', `/chats/${roomId}`, {
				roomId: roomId,
				message: 'invalid',
				toMid: firstMid,
			}, 'herp');
			assert.strictEqual(body.status.message, 'You do not have enough privileges for this action.');
		});
	});

	describe('edit/delete', () => {
		const socketModules = require('../src/socket.io/modules');
		let mid;
		let mid2;
		before(async () => {
			await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.baz.uid] }, 'foo');
			let { body } = await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: 'first chat message' }, 'foo');
			mid = body.response.messageId;
			({ body } = await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: 'second chat message' }, 'baz'));
			mid2 = body.response.messageId;
		});

		after(async () => {
			await callv3API('delete', `/chats/${roomId}/users/${mocks.users.baz.uid}`, {}, 'baz');
		});

		it('should fail to edit message with invalid data', async () => {
			let { statusCode, body } = await callv3API('put', `/chats/1/messages/10000`, { message: 'foo' }, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-mid]]'));

			({ statusCode, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, {}, 'foo'));
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-chat-message]]'));
		});

		it('should fail to edit message if new content is empty string', async () => {
			const { statusCode, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, { message: ' ' }, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-chat-message]]'));
		});

		it('should fail to edit message if not own message', async () => {
			const { statusCode, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, { message: 'message edited' }, 'herp');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:cant-edit-chat-message]]'));
		});

		it('should fail to edit message if message not in room', async () => {
			const { statusCode, body } = await callv3API('put', `/chats/${roomId}/messages/1014`, { message: 'message edited' }, 'herp');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-mid]]'));
		});

		it('should edit message', async () => {
			let { statusCode, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, { message: 'message edited' }, 'foo');
			assert.strictEqual(statusCode, 200);
			assert.strictEqual(body.response.content, 'message edited');

			({ statusCode, body } = await callv3API('get', `/chats/${roomId}/messages/${mid}`, {}, 'foo'));
			assert.strictEqual(statusCode, 200);
			assert.strictEqual(body.response.content, 'message edited');
		});

		it('should fail to delete message if not owner', async () => {
			const { statusCode, body } = await callv3API('delete', `/chats/${roomId}/messages/${mid}`, {}, 'herp');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, 'You are not allowed to delete this message');
		});

		it('should mark the message as deleted', async () => {
			await callv3API('delete', `/chats/${roomId}/messages/${mid}`, {}, 'foo');
			const value = await db.getObjectField(`message:${mid}`, 'deleted');
			assert.strictEqual(1, parseInt(value, 10));
		});

		it('should show deleted message to original users', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			const { messages } = body.response;

			// Reduce messages to their mids
			const mids = messages.reduce((mids, cur) => {
				mids.push(cur.messageId);
				return mids;
			}, []);

			assert(mids.includes(mid));
		});

		it('should not show deleted message to other users', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'herp');
			const { messages } = body.response;
			messages.forEach((msg) => {
				assert(!msg.deleted || msg.content === '<p>[[modules:chat.message-deleted]]</p>', msg.content);
			});
		});

		it('should not show deleted message to other users', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}/messages/${mid}`, {}, 'herp');
			const message = body.response;
			assert.strictEqual(message.deleted, 1);
			assert.strictEqual(message.content, '<p>[[modules:chat.message-deleted]]</p>');
		});

		it('should error out if a message is deleted again', async () => {
			const { statusCode, body } = await callv3API('delete', `/chats/${roomId}/messages/${mid}`, {}, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, 'This chat message has already been deleted.');
		});

		it('should restore the message', async () => {
			await callv3API('post', `/chats/${roomId}/messages/${mid}`, {}, 'foo');
			const value = await db.getObjectField(`message:${mid}`, 'deleted');
			assert.strictEqual(0, parseInt(value, 10));
		});

		it('should error out if a message is restored again', async () => {
			const { statusCode, body } = await callv3API('post', `/chats/${roomId}/messages/${mid}`, {}, 'foo');
			assert.strictEqual(statusCode, 400);
			assert.strictEqual(body.status.message, 'This chat message has already been restored.');
		});

		describe('disabled via ACP', () => {
			before(async () => {
				meta.config.disableChatMessageEditing = true;
			});

			after(async () => {
				meta.config.disableChatMessageEditing = false;
			});

			it('should error out for regular users', async () => {
				const { statusCode, body } = await callv3API('delete', `/chats/${roomId}/messages/${mid2}`, {}, 'baz');
				assert.strictEqual(statusCode, 400);
				assert.strictEqual(body.status.message, 'chat-message-editing-disabled');
			});

			it('should succeed for administrators', async () => {
				await callv3API('delete', `/chats/${roomId}/messages/${mid2}`, {}, 'foo');
				await callv3API('post', `/chats/${roomId}/messages/${mid2}`, {}, 'foo');
			});

			it('should succeed for global moderators', async () => {
				await Groups.join(['Global Moderators'], mocks.users.baz.uid);

				await callv3API('delete', `/chats/${roomId}/messages/${mid2}`, {}, 'baz');
				await callv3API('post', `/chats/${roomId}/messages/${mid2}`, {}, 'baz');

				await Groups.leave(['Global Moderators'], mocks.users.baz.uid);
			});
		});
	});

	describe('controller', () => {
		it('should 404 if chat is disabled', async () => {
			meta.config.disableChat = 1;
			const response = await request(`${nconf.get('url')}/user/baz/chats`, {
				resolveWithFullResponse: true,
				simple: false,
			});

			assert.equal(response.statusCode, 404);
		});

		it('should 401 for guest with not-authorised status code', async () => {
			meta.config.disableChat = 0;
			const response = await request(`${nconf.get('url')}/api/user/baz/chats`, {
				resolveWithFullResponse: true,
				simple: false,
				json: true,
			});
			const { body } = response;

			assert.equal(response.statusCode, 401);
			assert.equal(body.status.code, 'not-authorised');
		});

		it('should 404 for non-existent user', async () => {
			const response = await request(`${nconf.get('url')}/user/doesntexist/chats`, {
				resolveWithFullResponse: true,
				simple: false,
			});

			assert.equal(response.statusCode, 404);
		});
	});

	describe('logged in chat controller', () => {
		let jar;
		before(async () => {
			({ jar } = await helpers.loginUser('herp', 'derpderp'));
		});

		it('should return chats page data', async () => {
			const response = await request(`${nconf.get('url')}/api/user/herp/chats`, {
				resolveWithFullResponse: true,
				simple: false,
				json: true,
				jar,
			});
			const { body } = response;

			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body.rooms));
			assert.equal(body.rooms.length, 3);
			assert.equal(body.title, '[[pages:chats]]');
		});

		it('should return room data', async () => {
			const response = await request(`${nconf.get('url')}/api/user/herp/chats/${roomId}`, {
				resolveWithFullResponse: true,
				simple: false,
				json: true,
				jar,
			});
			const { body } = response;

			assert.equal(response.statusCode, 200);
			assert.equal(body.roomId, roomId);
			assert.equal(body.isOwner, false);
		});

		it('should redirect to chats page', async () => {
			const res = await request(`${nconf.get('url')}/api/chats`, {
				resolveWithFullResponse: true,
				simple: false,
				jar,
				json: true,
			});
			const { body } = res;

			assert.equal(res.statusCode, 200);
			assert.equal(res.headers['x-redirect'], '/user/herp/chats');
			assert.equal(body, '/user/herp/chats');
		});

		it('should return 404 if user is not in room', async () => {
			const data = await helpers.loginUser('baz', 'quuxquux');
			const response = await request(`${nconf.get('url')}/api/user/baz/chats/${roomId}`, {
				resolveWithFullResponse: true,
				simple: false,
				json: true,
				jar: data.jar,
			});

			assert.equal(response.statusCode, 404);
		});
	});
});
