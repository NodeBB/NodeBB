'use strict';

const assert = require('assert');
const activitypub = require('../../src/activitypub');
const db = require('../../src/database');

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

		await Promise.all(followers.map(f => Promise.all([
			db.sortedSetAdd('relays:state', -1, f),
			db.sortedSetAdd('relays:createtime', Date.now(), f),
		])));

		await activitypub.relays.broadcast(payload);

		assert.strictEqual(sentTo.length, 1);
		assert.deepStrictEqual(sentTo[0].targets, followers);
		assert.deepStrictEqual(sentTo[0].payload, payload);

		// Cleanup
		activitypub.send = originalSend;
		await db.sortedSetRemove('relays:state', followers[0]);
		await db.sortedSetRemove('relays:createtime', followers[0]);
		await db.sortedSetRemove('relays:state', followers[1]);
		await db.sortedSetRemove('relays:createtime', followers[1]);
	});
});
