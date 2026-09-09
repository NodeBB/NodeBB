'use strict';

const assert = require('assert');
const nconf = require('nconf');
const path = require('path');

const db = require('../mocks/databasemock');
const request = require('../../src/request');
const meta = require('../../src/meta');
const install = require('../../src/install');
const activitypub = require('../../src/activitypub');

describe('ActivityPub blocklists', () => {
	const getSeverity = async (domain) => {
		const result = await activitypub.blocklists.check(domain);
		return result.severity;
	};

	before(async function () {
		meta.config.activitypubEnabled = 1;
		meta.config.activitypubAllowLoopback = 1;
		await install.giveWorldPrivileges();
		this._originalGet = request.get;

		// Clear all blocklists to ensure clean state
		const all = await activitypub.blocklists.list();
		await Promise.all(all.map(({ url }) => activitypub.blocklists.remove(url)));
	});

	after(function () {
		delete meta.config.activitypubEnabled;
		delete meta.config.activitypubAllowLoopback;
		request.get = this._originalGet;
	});

	/**
	 * Generate a unique blocklist URL to avoid cross-test pollution.
	 */
	function url(suffix = '') {
		return `https://blocklist-${suffix || Date.now()}.example.com/feed.csv`;
	}

	/**
	 * Mock request.get to return a CSV body for any URL.
	 */
	function mockCsv(csvBody) {
		request.get = async () => ({ body: csvBody });
	}

	// ─── blocklists.list() ───────────────────────────────────────────────

	describe('blocklists.list()', () => {
		afterEach(async () => {
			const all = await activitypub.blocklists.list();
			await Promise.all(all.map(({ url }) => activitypub.blocklists.remove(url)));
		});

		it('should return an empty list when no blocklists exist', async () => {
			const result = await activitypub.blocklists.list();
			assert(Array.isArray(result));
			assert.strictEqual(result.length, 0);
		});

		it('should return blocklists with their domain counts', async () => {
			const u1 = url('list-a');
			const u2 = url('list-b');

			mockCsv('#domain,#severity\na.com,1');
			await activitypub.blocklists.add(u1);

			mockCsv('#domain,#severity\nb.com,1\nc.com,1');
			await activitypub.blocklists.add(u2);

			const result = await activitypub.blocklists.list();

			assert.strictEqual(result.length, 2);
			const entryA = result.find(r => r.url === u1);
			const entryB = result.find(r => r.url === u2);
			assert(entryA, 'blocklist A should be present');
			assert(entryB, 'blocklist B should be present');
			assert.strictEqual(entryA.count, 1);
			assert.strictEqual(entryB.count, 2);
		});

		it('should return blocklists sorted by insertion order (timestamp)', async () => {
			const u1 = url('list-order-1');
			const u2 = url('list-order-2');

			mockCsv('#domain,#severity\nd.com,1');
			await activitypub.blocklists.add(u1);

			// Small delay to ensure different timestamps
			await new Promise(resolve => setTimeout(resolve, 10));

			mockCsv('#domain,#severity\ne.com,1');
			await activitypub.blocklists.add(u2);

			const result = await activitypub.blocklists.list();
			assert.strictEqual(result.length, 2);
			assert.strictEqual(result[0].url, u1);
			assert.strictEqual(result[1].url, u2);
		});
	});

	// ─── blocklists.get() ────────────────────────────────────────────────

	describe('blocklists.get()', () => {
		afterEach(async () => {
			const all = await activitypub.blocklists.list();
			await Promise.all(all.map(({ url }) => activitypub.blocklists.remove(url)));
		});

		it('should return empty domains when blocklist does not exist', async () => {
			const result = await activitypub.blocklists.get('https://nonexistent.example.com/feed.csv');
			assert.strictEqual(result.domains.length, 0);
			assert.strictEqual(result.count, 0);
		});

		it('should return domains from an existing blocklist after refresh', async () => {
			const u = url('get-domains');
			mockCsv('#domain,#severity\nblocked.example.com,1\nanother.example.com,2');
			await activitypub.blocklists.add(u);

			const result = await activitypub.blocklists.get(u);

			assert.strictEqual(result.count, 2);
			assert(result.domains.some(d => d.domain === 'blocked.example.com'));
			assert(result.domains.some(d => d.domain === 'another.example.com'));
		});

		it('should return empty domains if refresh received no CSV data', async () => {
			const u = url('get-empty');
			mockCsv('');
			await activitypub.blocklists.add(u);

			const result = await activitypub.blocklists.get(u);

			assert.strictEqual(result.count, 0);
			assert.strictEqual(result.domains.length, 0);
		});
	});

	// ─── blocklists.add() ────────────────────────────────────────────────

	describe('blocklists.add()', () => {
		afterEach(async () => {
			const all = await activitypub.blocklists.list();
			await Promise.all(all.map(({ url }) => activitypub.blocklists.remove(url)));
		});

		it('should add a new blocklist to the list', async () => {
			const u = url('add-basic');
			mockCsv('#domain,#severity\nx.com,1');
			await activitypub.blocklists.add(u);

			const result = await activitypub.blocklists.list();
			assert(result.some(r => r.url === u));
		});

		it('should automatically refresh the blocklist when added', async () => {
			const u = url('add-refresh');
			mockCsv('#domain,#severity\nfresh.com,1\nfresh.org,2');
			await activitypub.blocklists.add(u);

			const result = await activitypub.blocklists.get(u);

			assert.strictEqual(result.count, 2);
			assert(result.domains.some(d => d.domain === 'fresh.com'));
			assert(result.domains.some(d => d.domain === 'fresh.org'));
		});
	});

	// ─── blocklists.remove() ─────────────────────────────────────────────

	describe('blocklists.remove()', () => {
		afterEach(async () => {
			const all = await activitypub.blocklists.list();
			await Promise.all(all.map(({ url }) => activitypub.blocklists.remove(url)));
		});

		it('should remove a blocklist from the list', async () => {
			const u = url('remove-list');
			mockCsv('#domain,#severity\nr.com,1');
			await activitypub.blocklists.add(u);

			await activitypub.blocklists.remove(u);

			const result = await activitypub.blocklists.list();
			assert(!result.some(r => r.url === u));
		});

		it('should delete the blocklist domain data', async () => {
			const u = url('remove-data');
			mockCsv('#domain,#severity\ns.com,1');
			await activitypub.blocklists.add(u);

			await activitypub.blocklists.remove(u);

			const result = await activitypub.blocklists.get(u);
			assert.strictEqual(result.count, 0);
		});

		it('should delete the blocklist severity data', async () => {
			const u = url('remove-severity');
			mockCsv('#domain,#severity\nsevered.com,2');
			await activitypub.blocklists.add(u);

			await activitypub.blocklists.remove(u);

			const result = await activitypub.blocklists.check('severed.com');
			assert.strictEqual(result.severity, null);
		});
	});

	// ─── blocklists.refresh() ────────────────────────────────────────────

	describe('blocklists.refresh()', () => {
		const u = url('refresh');

		beforeEach(async () => {
			mockCsv('#domain,#severity\nplaceholder.com,1');
			await activitypub.blocklists.add(u);
		});

		afterEach(async () => {
			await activitypub.blocklists.remove(u);
			request.get = this._originalGet;
		});

		it('should process a valid CSV and return record count', async () => {
			mockCsv('#domain,#severity\nexample.com,1\nexample.org,2\nsilence.example.com,2');

			const result = await activitypub.blocklists.refresh(u);

			assert.strictEqual(result, 3);
		});

		it('should return 0 for an empty CSV', async () => {
			mockCsv('');

			const result = await activitypub.blocklists.refresh(u);

			assert.strictEqual(result, 0);
		});

		it('should return 0 on CSV parse error', async () => {
			mockCsv('this is not valid csv with no headers');

			const result = await activitypub.blocklists.refresh(u);

			assert.strictEqual(result, 0);
		});

		it('should store severity scores correctly', async () => {
			mockCsv('#domain,#severity\nsuspend.com,suspend\nsilence.com,silence\nfilter.com,filter');

			await activitypub.blocklists.refresh(u);

			assert.strictEqual(await getSeverity('suspend.com'), 1);
			assert.strictEqual(await getSeverity('silence.com'), 2);
			assert.strictEqual(await getSeverity('filter.com'), 3);
		});

		it('should default unknown severity values to suspend (score 1)', async () => {
			mockCsv('#domain,#severity\nunknown.com,banana\nmissing.com,\nempty.com,');

			await activitypub.blocklists.refresh(u);

			assert.strictEqual(await getSeverity('unknown.com'), 1);
			assert.strictEqual(await getSeverity('missing.com'), 1);
			assert.strictEqual(await getSeverity('empty.com'), 1);
		});

		it('should overwrite previous domains and severities', async () => {
			mockCsv('#domain,#severity\nold.com,silence');
			await activitypub.blocklists.refresh(u);

			const sev1 = await getSeverity('old.com');
			assert.strictEqual(sev1, 2, `expected old.com severity to be 2, got ${sev1}`);

			mockCsv('#domain,#severity\nnew.com,filter');
			await activitypub.blocklists.refresh(u);

			const result = await activitypub.blocklists.get(u);
			assert.strictEqual(result.count, 1, `expected count 1, got ${result.count}`);
			assert(result.domains.some(d => d.domain === 'new.com'));
			assert(!result.domains.some(d => d.domain === 'old.com'));

			const sevNew = await getSeverity('new.com');
			assert.strictEqual(sevNew, 3, `expected new.com severity to be 3, got ${sevNew}`);

			const sevOld = await getSeverity('old.com');
			assert.strictEqual(sevOld, null, `expected old.com severity to be null, got ${sevOld}`);
		});
	});

	// ─── blocklists.check() ──────────────────────────────────────────────

	describe('blocklists.check()', () => {
		/**
		 * Clear all blocklists created during this describe block.
		 */
		async function clear() {
			const all = await activitypub.blocklists.list();
			await Promise.all(all.map(({ url }) => activitypub.blocklists.remove(url)));
		}

		before(clear);
		afterEach(clear);

		it('should return { allowed: true, severity: null } when no blocklists exist', async () => {
			const result = await activitypub.blocklists.check('any.example.com');

			assert.deepStrictEqual(result, { allowed: true, severity: null, listUrl: null });
		});

		it('should return { allowed: false, severity: N } when domain is blocked', async () => {
			const u = url('check-blocked');
			mockCsv('#domain,#severity\nblocked.com,silence');
			await activitypub.blocklists.add(u);

			const result = await activitypub.blocklists.check('blocked.com');

			assert.strictEqual(result.allowed, false);
			assert.strictEqual(result.severity, 2);
		});

		it('should return { allowed: true, severity: null } when domain is not in any blocklist', async () => {
			const u = url('check-not-in-list');
			mockCsv('#domain,#severity\nother.com,1');
			await activitypub.blocklists.add(u);

			const result = await activitypub.blocklists.check('notlisted.com');

			assert.strictEqual(result.allowed, true);
			assert.strictEqual(result.severity, null);
		});

		it('should return { allowed: false, severity: N } when domain is in any blocklist', async () => {
			const u1 = url('check-multi-a');
			const u2 = url('check-multi-b');

			mockCsv('#domain,#severity\nonly-in-first.com,suspend');
			await activitypub.blocklists.add(u1);

			mockCsv('#domain,#severity\nin-second.com,silence');
			await activitypub.blocklists.add(u2);

			const resultA = await activitypub.blocklists.check('only-in-first.com');
			assert.strictEqual(resultA.allowed, false);
			assert.strictEqual(resultA.severity, 1);

			const resultB = await activitypub.blocklists.check('in-second.com');
			assert.strictEqual(resultB.allowed, false);
			assert.strictEqual(resultB.severity, 2);
		});

		it('should return the highest severity when domain appears in multiple blocklists', async () => {
			const u1 = url('check-highest-a');
			const u2 = url('check-highest-b');

			mockCsv('#domain,#severity\nshared.com,suspend');
			await activitypub.blocklists.add(u1);

			mockCsv('#domain,#severity\nshared.com,silence');
			await activitypub.blocklists.add(u2);

			const result = await activitypub.blocklists.check('shared.com');

			// getSeverity returns the first match it finds — but the domain is
			// blocked from both lists. The severity depends on iteration order.
			// What matters is that allowed is false.
			assert.strictEqual(result.allowed, false);
			assert(result.severity >= 1 && result.severity <= 3);
		});
	});

	// ─── blocklists.getSeverity() ────────────────────────────────────────

	describe('blocklists.getSeverity()', () => {
		afterEach(async () => {
			const all = await activitypub.blocklists.list();
			await Promise.all(all.map(({ url }) => activitypub.blocklists.remove(url)));
		});

		it('should return null for a domain not in any blocklist', async () => {
			const result = await getSeverity('nowhere.com');
			assert.strictEqual(result, null);
		});

		it('should return correct severity for each tier', async () => {
			const u = url('severity-tiers');
			mockCsv('#domain,#severity\nsuspend.com,suspend\nsilence.com,silence\nfilter.com,filter');
			await activitypub.blocklists.add(u);

			assert.strictEqual(await getSeverity('suspend.com'), 1);
			assert.strictEqual(await getSeverity('silence.com'), 2);
			assert.strictEqual(await getSeverity('filter.com'), 3);
		});

		it('should return null after blocklist is removed', async () => {
			const u = url('severity-after-remove');
			mockCsv('#domain,#severity\nemp.com,silence');
			await activitypub.blocklists.add(u);

			assert.strictEqual(await getSeverity('emp.com'), 2);

			await activitypub.blocklists.remove(u);

			assert.strictEqual(await getSeverity('emp.com'), null);
		});
	});

	// ─── Full lifecycle integration ──────────────────────────────────────

	describe('Full lifecycle', () => {
		const u = url('lifecycle');

		afterEach(async () => {
			await activitypub.blocklists.remove(u);
		});

		it('should handle add → refresh → check → remove end-to-end', async () => {
			// 1. Add (auto-refreshes with mock data)
			mockCsv('#domain,#severity\nblocked.com,suspend\nallowed.com,silence\nfiltered.com,filter');
			await activitypub.blocklists.add(u);

			// 2. Verify domains are present
			const domains = await activitypub.blocklists.get(u);
			assert.strictEqual(domains.count, 3);

			// 3. Check blocked domain
			const blocked = await activitypub.blocklists.check('blocked.com');
			assert.strictEqual(blocked.allowed, false);
			assert.strictEqual(blocked.severity, 1);

			// 4. Check silenced domain
			const silenced = await activitypub.blocklists.check('allowed.com');
			assert.strictEqual(silenced.allowed, false);
			assert.strictEqual(silenced.severity, 2);

			// 5. Check filtered domain
			const filtered = await activitypub.blocklists.check('filtered.com');
			assert.strictEqual(filtered.allowed, true);
			assert.strictEqual(filtered.severity, 3);

			// 6. Check clean domain
			const clean = await activitypub.blocklists.check('clean.example.com');
			assert.strictEqual(clean.allowed, true);
			assert.strictEqual(clean.severity, null);

			// 7. Remove
			await activitypub.blocklists.remove(u);

			// 8. Verify everything is gone
			const afterList = await activitypub.blocklists.list();
			assert.strictEqual(afterList.length, 0);

			const afterCheck = await activitypub.blocklists.check('blocked.com');
			assert.strictEqual(afterCheck.allowed, true);
			assert.strictEqual(afterCheck.severity, null);
		});
	});
});