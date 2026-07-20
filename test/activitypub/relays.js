'use strict';

const assert = require('assert');
const activitypub = require('../../src/activitypub');
const db = require('../../src/database');

describe('ActivityPub Relays', () => {
	const actor = 'https://example.com/actor';

	afterEach(async () => {
		await db.sortedSetRemove('relays:followers', actor);
	});

	it('should add a relay follower', async () => {
		await activitypub.relays.addFollower(actor);
		const exists = await db.isSortedSetMember('relays:followers', actor);
		assert.strictEqual(exists, true);
	});

	it('should remove a relay follower', async () => {
		await activitypub.relays.addFollower(actor);
		await activitypub.relays.removeFollower(actor);
		const exists = await db.isSortedSetMember('relays:followers', actor);
		assert.strictEqual(exists, false);
	});

	it('should get relay followers', async () => {
		const actor2 = 'https://example2.com/actor';
		await Promise.all([
			activitypub.relays.addFollower(actor),
			activitypub.relays.addFollower(actor2),
		]);

		const followers = await activitypub.relays.getFollowers();
		assert.strictEqual(followers.length, 2);
		assert.ok(followers.includes(actor));
		assert.ok(followers.includes(actor2));

		await db.sortedSetRemove('relays:followers', actor2);
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

		await Promise.all(followers.map(f => activitypub.relays.addFollower(f)));

		await activitypub.relays.broadcast(payload);

		assert.strictEqual(sentTo.length, 1);
		assert.deepStrictEqual(sentTo[0].targets, followers);
		assert.deepStrictEqual(sentTo[0].payload, payload);

		// Cleanup
		activitypub.send = originalSend;
		await db.sortedSetRemove('relays:followers', followers[0]);
		await db.sortedSetRemove('relays:followers', followers[1]);
	});
});
