'use strict';

const assert = require('assert');
const nconf = require('nconf');
const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const install = require('../../src/install');
const activitypub = require('../../src/activitypub');

describe('ActivityPub instances', () => {
	before(async function () {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	after(async function () {
		delete meta.config.activitypubFilter;
	});

	describe('Instances.log', () => {
		beforeEach(async () => {
			await db.delete('instances:lastSeen');
		});

		afterEach(async () => {
			await db.delete('instances:lastSeen');
		});

		it('should add a domain to the instances:lastSeen sorted set', async () => {
			await activitypub.instances.log('example.org');
			const members = await db.getSortedSetMembers('instances:lastSeen');
			assert.strictEqual(members.length, 1);
			assert.strictEqual(members[0], 'example.org');
		});

		it('should update the score when logging an existing domain', async () => {
			await activitypub.instances.log('example.org');
			const initialScore = await db.sortedSetScore('instances:lastSeen', 'example.org');

			// Wait a moment to ensure score changes
			await new Promise(resolve => setTimeout(resolve, 10));
			await activitypub.instances.log('example.org');

			const newScore = await db.sortedSetScore('instances:lastSeen', 'example.org');
			assert(newScore > initialScore, 'Score should be updated on re-log');
		});
	});

	describe('Instances.getCount', () => {
		beforeEach(async () => {
			await db.delete('instances:lastSeen');
		});

		afterEach(async () => {
			await db.delete('instances:lastSeen');
		});

		it('should return 0 for an empty sorted set', async () => {
			const count = await activitypub.instances.getCount();
			assert.strictEqual(count, 0);
		});

		it('should return the correct count for multiple domains', async () => {
			await activitypub.instances.log('example.org');
			await activitypub.instances.log('test.org');
			await activitypub.instances.log('demo.org');

			const count = await activitypub.instances.getCount();
			assert.strictEqual(count, 3);
		});
	});

	describe('Instances.list', () => {
		beforeEach(async () => {
			await db.delete('instances:lastSeen');
		});

		afterEach(async () => {
			await db.delete('instances:lastSeen');
		});

		it('should return an empty array for no domains', async () => {
			const list = await activitypub.instances.list();
			assert.strictEqual(list.length, 0);
		});

		it('should return all logged domains', async () => {
			await activitypub.instances.log('example.org');
			await activitypub.instances.log('test.org');

			const list = await activitypub.instances.list();
			assert.strictEqual(list.length, 2);
			assert(list.includes('example.org'));
			assert(list.includes('test.org'));
		});
	});

	describe('Instances.isAllowed', () => {
		beforeEach(async () => {
			delete meta.config.activitypubFilter;
			// Clear core blocklist
			await db.delete('blocklist:core');
			await db.delete('blocklist:core:severity');
		});

		afterEach(async () => {
			delete meta.config.activitypubFilter;
			await db.delete('blocklist:core');
			await db.delete('blocklist:core:severity');
		});

		it('should allow domains not on any blocklist', async () => {
			const result = await activitypub.instances.isAllowed('example.org');
			assert.strictEqual(result.allowed, true);
		});

		it('should block domains on the core blocklist with severity suspend', async () => {
			await db.sortedSetAdd('blocklist:core', Date.now(), 'blocked.org');
			await db.setObjectField('blocklist:core:severity', 'blocked.org', 'suspend');

			const result = await activitypub.instances.isAllowed('blocked.org');
			assert.strictEqual(result.allowed, false);
		});

		it('should block domains on the core blocklist with severity silence', async () => {
			await db.sortedSetAdd('blocklist:core', Date.now(), 'blocked.org');
			await db.setObjectField('blocklist:core:severity', 'blocked.org', 'silence');

			const result = await activitypub.instances.isAllowed('blocked.org');
			assert.strictEqual(result.allowed, false);
		});

		it('should allow domains on the core blocklist with severity filter', async () => {
			await db.sortedSetAdd('blocklist:core', Date.now(), 'filtered.org');
			await db.setObjectField('blocklist:core:severity', 'filtered.org', 'filter');

			const result = await activitypub.instances.isAllowed('filtered.org');
			assert.strictEqual(result.allowed, true);
		});

		it('should allow domains not on the core blocklist in blocklist mode', async () => {
			await db.sortedSetAdd('blocklist:core', Date.now(), 'blocked.org');
			await db.setObjectField('blocklist:core:severity', 'blocked.org', 'suspend');

			const result = await activitypub.instances.isAllowed('example.org');
			assert.strictEqual(result.allowed, true);
		});

		describe('allowlist mode (type=1)', () => {
			beforeEach(async () => {
				meta.config.activitypubFilter = 1;
			});

			it('should allow domains on the core blocklist', async () => {
				await db.sortedSetAdd('blocklist:core', Date.now(), 'allowed.org');

				const result = await activitypub.instances.isAllowed('allowed.org');
				assert.strictEqual(result.allowed, true);
			});

			it('should block domains not on the core blocklist', async () => {
				const result = await activitypub.instances.isAllowed('blocked.org');
				assert.strictEqual(result.allowed, false);
			});

			it('should ignore severity in allowlist mode', async () => {
				await db.sortedSetAdd('blocklist:core', Date.now(), 'filtered.org');
				await db.setObjectField('blocklist:core:severity', 'filtered.org', 'filter');

				const result = await activitypub.instances.isAllowed('filtered.org');
				assert.strictEqual(result.allowed, true);
			});
		});

		describe('blocklist mode (type=0)', () => {
			beforeEach(async () => {
				meta.config.activitypubFilter = 0;
			});

			it('should block domains on the core blocklist with severity suspend', async () => {
				await db.sortedSetAdd('blocklist:core', Date.now(), 'blocked.org');
				await db.setObjectField('blocklist:core:severity', 'blocked.org', 'suspend');

				const result = await activitypub.instances.isAllowed('blocked.org');
				assert.strictEqual(result.allowed, false);
			});

			it('should allow domains not on the core blocklist', async () => {
				const result = await activitypub.instances.isAllowed('example.org');
				assert.strictEqual(result.allowed, true);
			});
		});
	});
});
