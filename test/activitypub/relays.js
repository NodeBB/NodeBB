'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');
const activitypub = require('../../src/activitypub');

describe('ActivityPub Relays', () => {
	const actor = 'https://example.com/actor';

	afterEach(async () => {
		await db.sortedSetRemove('relays:state', actor);
		await db.sortedSetRemove('relays:createtime', actor);
	});

	it('should add a relay follower', async () => {
		await db.sortedSetAdd('relays:state', -1, actor);
		await db.sortedSetAdd('relays:createtime', Date.now(), actor);
		const score = await db.sortedSetScore('relays:state', actor);
		assert.strictEqual(score, -1);
	});

	it('should remove a relay follower', async () => {
		await db.sortedSetAdd('relays:state', -1, actor);
		await db.sortedSetAdd('relays:createtime', Date.now(), actor);
		await activitypub.relays.removeFollower(actor);
		const score = await db.sortedSetScore('relays:state', actor);
		assert.strictEqual(score, null);
	});

	it('should get relay followers', async () => {
		const actor2 = 'https://example2.com/actor';
		await Promise.all([
			db.sortedSetAdd('relays:state', -1, actor),
			db.sortedSetAdd('relays:createtime', Date.now(), actor),
			db.sortedSetAdd('relays:state', -1, actor2),
			db.sortedSetAdd('relays:createtime', Date.now(), actor2),
		]);

		const followers = await activitypub.relays.getFollowers();
		assert.strictEqual(followers.length, 2);
		assert.ok(followers.includes(actor));
		assert.ok(followers.includes(actor2));

		await db.sortedSetRemove('relays:state', actor2);
		await db.sortedSetRemove('relays:createtime', actor2);
	});

	it('should broadcast to relay followers', async () => {
		const payload = { type: 'Create', id: '123' };
		const followers = ['https://f1.com/actor', 'https://f2.com/actor'];

		// Mock activitypub.send
		const originalSend = activitypub.send;
		const sentTo = [];
		activitypub.send = async (type, id, targets, payload) => {
			sentTo.push({ targets, payload });
			return true;
		};

		await Promise.all([
			db.sortedSetAdd('relays:state', -1, followers[0]),
			db.sortedSetAdd('relays:createtime', Date.now(), followers[0]),
			db.sortedSetAdd('relays:state', -1, followers[1]),
			db.sortedSetAdd('relays:createtime', Date.now(), followers[1]),
		]);

		await activitypub.relays.broadcast(payload);

		assert.strictEqual(sentTo.length, 1);
		assert.ok(sentTo[0].targets.includes(followers[0]));
		assert.ok(sentTo[0].targets.includes(followers[1]));
		const sentPayload = sentTo[0].payload;
		assert.strictEqual(sentPayload.type, 'Announce');
		assert.strictEqual(sentPayload.actor, 'https://localhost/actor');
		assert.deepStrictEqual(sentPayload.object, payload);
		assert.deepStrictEqual(sentPayload.to, ['https://www.w3.org/ns/activitystreams#Public']);
		assert.ok(sentPayload.id.startsWith('https://localhost/post/123#activity/announce/relay/'));

		// Cleanup
		activitypub.send = originalSend;
		await db.sortedSetRemove('relays:state', followers[0]);
		await db.sortedSetRemove('relays:createtime', followers[0]);
		await db.sortedSetRemove('relays:state', followers[1]);
		await db.sortedSetRemove('relays:createtime', followers[1]);
	});
});
