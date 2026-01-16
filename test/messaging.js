'use strict';

const assert = require('assert');

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
const request = require('../src/request');
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
			body,
			jar: mocks.users[user].jar,
		};

		if (method !== 'get') {
			options.headers = {
				'x-csrf-token': mocks.users[user].csrf,
			};
		}

		return request[method](`${nconf.get('url')}/api/v3${path}`, options);
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
		await User.setSetting(mocks.users.baz.uid, 'disableIncomingChats', '1');

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

	describe('.canMessageUser()', () => {
		it('should allow messages to be sent to an unrestricted user', (done) => {
			Messaging.canMessageUser(mocks.users.baz.uid, mocks.users.herp.uid, (err) => {
				assert.ifError(err);
				done();
			});
		});

		it('should NOT allow messages to be sent to a restricted user', async () => {
			await User.setSetting(mocks.users.baz.uid, 'disableIncomingMessages', '1');
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

		it('should respect allow/deny list when sending chat messages', async () => {
			const uid1 = await User.create({ username: 'allowdeny1', password: 'barbar' });
			const uid2 = await User.create({ username: 'allowdeny2', password: 'bazbaz' });
			const uid3 = await User.create({ username: 'allowdeny3', password: 'bazbaz' });
			await Messaging.canMessageUser(uid1, uid2);

			// rejects uid1 only allows uid3 to chat
			await User.setSetting(uid1, 'chatAllowList', JSON.stringify([uid3]));
			await assert.rejects(
				Messaging.canMessageUser(uid2, uid1),
				{ message: '[[error:chat-restricted]]' },
			);

			// rejects uid2 denies chat from uid1
			await User.setSetting(uid2, 'chatDenyList', JSON.stringify([uid1]));
			await assert.rejects(
				Messaging.canMessageUser(uid1, uid2),
				{ message: '[[error:chat-restricted]]' },
			);
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
		const _delay1 = meta.config.chatMessageDelay;
		const _delay2 = meta.config.newbieChatMessageDelay;
		before(async () => {
			meta.config.chatMessageDelay = 0;
			meta.config.newbieChatMessageDelay = 0;
		});

		after(async () => {
			meta.config.chatMessageDelay = _delay1;
			meta.config.newbieChatMessageDelay = _delay2;
		});

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

			const { response, body } = await callv3API('post', `/chats`, {
				uids: [mocks.users.baz.uid],
			}, 'foo');

			assert.equal(response.statusCode, 400);
			assert.equal(body.status.code, 'bad-request');
			assert.equal(body.status.message, await translator.translate('[[error:too-many-messages]]'));
			meta.config.chatMessageDelay = oldValue;
		});

		it('should create a new chat room', async () => {
			await User.setSetting(mocks.users.baz.uid, 'disableIncomingMessages', '0');
			const { body } = await callv3API('post', `/chats`, {
				uids: [mocks.users.baz.uid],
				joinLeaveMessages: 1,
			}, 'foo');
			await User.setSetting(mocks.users.baz.uid, 'disableIncomingMessages', '1');

			roomId = body.response.roomId;
			assert(roomId);
		});

		it('should send a user-join system message when a chat room is created', async () => {
			const { body } = await callv3API('get', `/chats/${roomId}`, {}, 'foo');
			const { messages } = body.response;
			assert.equal(messages.length, 2);
			assert.strictEqual(messages[0].system, 1);
			assert.strictEqual(messages[0].content, 'user-join');

			const { response, body: body2 } = await callv3API('put', `/chats/${roomId}/messages/${messages[0].messageId}`, {
				message: 'test',
			}, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.equal(body2.status.message, await translator.translate('[[error:cant-edit-chat-message]]'));
		});

		it('should fail to add user to room with invalid data', async () => {
			let { response, body } = await callv3API('post', `/chats/${roomId}/users`, {}, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:required-parameters-missing, uids]]'));

			({ response, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [null] }, 'foo'));
			assert.strictEqual(response.statusCode, 400);
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
			const { response, body } = await callv3API('get', `/chats/${roomId}/users`, {}, 'bar');
			assert.strictEqual(response.statusCode, 403);
			assert.equal(body.status.message, await translator.translate('[[error:no-privileges]]'));
		});

		it('should fail to add users to room if max is reached', async () => {
			meta.config.maximumUsersInChatRoom = 2;
			const { response, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.bar.uid] }, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.equal(body.status.message, await translator.translate('[[error:cant-add-more-users-to-chat-room]]'));
			meta.config.maximumUsersInChatRoom = 0;
		});

		it('should fail to add users to room if user does not exist', async () => {
			const { response, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [98237498234] }, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should fail to add self to room', async () => {
			const { response, body } = await callv3API('post', `/chats/${roomId}/users`, { uids: [mocks.users.foo.uid] }, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:cant-chat-with-yourself]]'));
		});

		it('should fail to leave room with invalid data', async () => {
			let { response, body } = await callv3API('delete', `/chats/${roomId}/users`, {}, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:required-parameters-missing, uids]]'));

			({ response, body } = await callv3API('delete', `/chats/${roomId}/users`, { uids: [98237423] }, 'foo'));
			assert.strictEqual(response.statusCode, 400);
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
			const { body } = await request.post(`${nconf.get('url')}/api/v3/chats`, {
				jar: senderJar,
				body: {
					uids: [receiver],
				},
				headers: {
					'x-csrf-token': senderCsrf,
				},
			});
			await User.deleteAccount(sender);
			assert(await Messaging.isRoomOwner(receiver, body.response.roomId));
		});

		it('should fail to remove user from room', async () => {
			let { response, body } = await callv3API('delete', `/chats/${roomId}/users`, {}, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:required-parameters-missing, uids]]'));

			({ response, body } = await callv3API('delete', `/chats/${roomId}/users`, { uids: [null] }, 'foo'));
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should fail to remove user from room if user does not exist', async () => {
			const { response, body } = await callv3API('delete', `/chats/${roomId}/users`, { uids: [99] }, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:no-user]]'));
		});

		it('should remove user from room', async () => {
			const { response, body } = await callv3API('post', `/chats`, {
				uids: [mocks.users.herp.uid],
			}, 'foo');
			const { roomId } = body.response;
			assert.strictEqual(response.statusCode, 200);

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
			const { content: raw } = await api.chats.getRawMessage(
				{ uid: mocks.users.foo.uid }, { mid: messageData.messageId, roomId }
			);
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

		it('should return invalid-data error', async () => {
			await assert.rejects(
				api.chats.getRawMessage({ uid: mocks.users.foo.uid }, undefined),
				{ message: '[[error:invalid-data]]' }
			);


			await assert.rejects(
				api.chats.getRawMessage({ uid: mocks.users.foo.uid }, {}),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should return not allowed error if user is not in room', async () => {
			const uids = await User.create({ username: 'dummy' });
			let { body } = await callv3API('post', '/chats', { uids: [uids] }, 'baz');
			const myRoomId = body.response.roomId;
			assert(myRoomId);

			try {
				await api.chats.getRawMessage({ uid: mocks.users.baz.uid }, { mid: 200 });
			} catch (err) {
				assert(err);
				assert.equal(err.message, '[[error:invalid-data]]');
			}

			({ body } = await callv3API('post', `/chats/${myRoomId}`, { roomId: myRoomId, message: 'admin will see this' }, 'baz'));
			const message = body.response;
			const { content } = await api.chats.getRawMessage(
				{ uid: mocks.users.foo.uid }, { mid: message.messageId, roomId: myRoomId }
			);
			assert.equal(content, 'admin will see this');
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
			assert.strictEqual(notification.bodyShort, `New message in <strong>Room ${roomId}</strong>`);
			assert(notification.nid.startsWith(`chat_${roomId}_${mocks.users.foo.uid}_`));
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

		it('should fail to rename room with invalid data', async () => {
			const { body } = await callv3API('put', `/chats/${roomId}`, { name: null }, 'foo');
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-data]]'));
		});

		it('should rename room', async () => {
			const { response } = await callv3API('put', `/chats/${roomId}`, { name: 'new room name' }, 'foo');
			assert.strictEqual(response.statusCode, 200);
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

		it('should return true if user is dnd', async () => {
			await db.setObjectField(`user:${mocks.users.herp.uid}`, 'status', 'dnd');
			const { status } = await api.users.getStatus({ uid: mocks.users.foo.uid }, { uid: mocks.users.herp.uid });
			assert.strictEqual(status, 'dnd');
		});

		it('should fail to load recent chats with invalid data', async () => {
			await assert.rejects(
				api.chats.list({ uid: mocks.users.foo.uid }, undefined),
				{ message: '[[error:invalid-data]]' }
			);

			await assert.rejects(
				api.chats.list({ uid: mocks.users.foo.uid }, { start: null }),
				{ message: '[[error:invalid-data]]' }
			);

			await assert.rejects(
				api.chats.list({ uid: mocks.users.foo.uid }, { start: 0, uid: null }),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should load recent chats of user', async () => {
			const { rooms } = await api.chats.list(
				{ uid: mocks.users.foo.uid }, { start: 0, stop: 9, uid: mocks.users.foo.uid }
			);
			assert(Array.isArray(rooms));
		});

		it('should escape teaser', async () => {
			await callv3API('post', `/chats/${roomId}`, { roomId: roomId, message: '<svg/onload=alert(document.location);' }, 'foo');
			const { rooms } = await api.chats.list(
				{ uid: mocks.users.foo.uid }, { start: 0, stop: 9, uid: mocks.users.foo.uid }
			);
			assert.equal(rooms[0].teaser.content, '&lt;svg&#x2F;onload=alert(document.location);');
		});

		it('should fail to check if user has private chat with invalid data', async () => {
			await assert.rejects(
				api.users.getPrivateRoomId({ uid: null }, undefined),
				{ message: '[[error:invalid-data]]' }
			);

			await assert.rejects(
				api.users.getPrivateRoomId({ uid: mocks.users.foo.uid }, undefined),
				{ message: '[[error:invalid-data]]' }
			);
		});

		it('should check if user has private chat with another uid', async () => {
			const { roomId } = await api.users.getPrivateRoomId({ uid: mocks.users.foo.uid }, { uid: mocks.users.herp.uid });
			assert(roomId);
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
			let { response, body } = await callv3API('put', `/chats/1/messages/10000`, { message: 'foo' }, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-mid]]'));

			({ response, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, {}, 'foo'));
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-chat-message]]'));
		});

		it('should fail to edit message if new content is empty string', async () => {
			const { response, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, { message: ' ' }, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-chat-message]]'));
		});

		it('should fail to edit message if not own message', async () => {
			const { response, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, { message: 'message edited' }, 'herp');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:cant-edit-chat-message]]'));
		});

		it('should fail to edit message if message not in room', async () => {
			const { response, body } = await callv3API('put', `/chats/${roomId}/messages/1014`, { message: 'message edited' }, 'herp');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, await translator.translate('[[error:invalid-mid]]'));
		});

		it('should edit message', async () => {
			let { response, body } = await callv3API('put', `/chats/${roomId}/messages/${mid}`, { message: 'message edited' }, 'foo');
			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(body.response.content, 'message edited');

			({ response, body } = await callv3API('get', `/chats/${roomId}/messages/${mid}`, {}, 'foo'));
			assert.strictEqual(response.statusCode, 200);
			assert.strictEqual(body.response.content, 'message edited');
		});

		it('should fail to delete message if not owner', async () => {
			const { response, body } = await callv3API('delete', `/chats/${roomId}/messages/${mid}`, {}, 'herp');
			assert.strictEqual(response.statusCode, 400);
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
			const { response, body } = await callv3API('delete', `/chats/${roomId}/messages/${mid}`, {}, 'foo');
			assert.strictEqual(response.statusCode, 400);
			assert.strictEqual(body.status.message, 'This chat message has already been deleted.');
		});

		it('should restore the message', async () => {
			await callv3API('post', `/chats/${roomId}/messages/${mid}`, {}, 'foo');
			const value = await db.getObjectField(`message:${mid}`, 'deleted');
			assert.strictEqual(0, parseInt(value, 10));
		});

		it('should error out if a message is restored again', async () => {
			const { response, body } = await callv3API('post', `/chats/${roomId}/messages/${mid}`, {}, 'foo');
			assert.strictEqual(response.statusCode, 400);
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
				const { response, body } = await callv3API('delete', `/chats/${roomId}/messages/${mid2}`, {}, 'baz');
				assert.strictEqual(response.statusCode, 400);
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
			const { response } = await request.get(`${nconf.get('url')}/user/baz/chats`);

			assert.equal(response.statusCode, 404);
		});

		it('should 401 for guest with not-authorised status code', async () => {
			meta.config.disableChat = 0;
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/baz/chats`);

			assert.equal(response.statusCode, 401);
			assert.equal(body.status.code, 'not-authorised');
		});

		it('should 404 for non-existent user', async () => {
			const { response } = await request.get(`${nconf.get('url')}/user/doesntexist/chats`);
			assert.equal(response.statusCode, 404);
		});
	});

	describe('logged in chat controller', () => {
		let jar;
		before(async () => {
			({ jar } = await helpers.loginUser('herp', 'derpderp'));
		});

		it('should return chats page data', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/herp/chats`, { jar });

			assert.equal(response.statusCode, 200);
			assert(Array.isArray(body.rooms));
			assert.equal(body.rooms.length, 2);
			assert.equal(body.title, '[[pages:chats]]');
		});

		it('should return room data', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/user/herp/chats/${roomId}`, { jar });

			assert.equal(response.statusCode, 200);
			assert.equal(body.roomId, roomId);
			assert.equal(body.isOwner, false);
		});

		it('should redirect to chats page', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/api/chats`, { jar });

			assert.equal(response.statusCode, 200);
			assert.equal(response.headers['x-redirect'], encodeURIComponent('/user/herp/chats'));
			assert.equal(body, '/user/herp/chats');
		});

		it('should return 404 if user is not in room', async () => {
			const data = await helpers.loginUser('baz', 'quuxquux');
			const { response } = await request.get(`${nconf.get('url')}/api/user/baz/chats/${roomId}`, { jar: data.jar });

			assert.equal(response.statusCode, 404);
		});
	});
});
