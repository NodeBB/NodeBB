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
	before(async function () {
		meta.config.activitypubEnabled = 1;
		meta.config.activitypubAllowLoopback = 1;
		await install.giveWorldPrivileges();
		this.getHandler = request.get;
	});

	after(function () {
		delete meta.config.activitypubEnabled;
		request.get = this.getHandler;
	});

	describe('blocklists.list()', () => {
		it('should return an empty list when no blocklists exist', async () => {
			const result = await activitypub.blocklists.list();
			assert(Array.isArray(result));
			assert.strictEqual(result.length, 0);
		});

		it('should return blocklists with their counts', async () => {
			const url1 = 'https://example.com/blocklist1.csv';
			const url2 = 'https://example.com/blocklist2.csv';

			await activitypub.blocklists.add(url1);
			await activitypub.blocklists.add(url2);

			const result = await activitypub.blocklists.list();

			assert.strictEqual(result.length, 2);
			assert(result.some(r => r.url === url1));
			assert(result.some(r => r.url === url2));
		});

		it('should return blocklists sorted by timestamp', async () => {
			const url1 = 'https://example.com/blocklist1.csv';
			const url2 = 'https://example.com/blocklist2.csv';

			await activitypub.blocklists.add(url1);
			await new Promise(resolve => setTimeout(resolve, 10));
			await activitypub.blocklists.add(url2);

			const result = await activitypub.blocklists.list();

			assert.strictEqual(result[0].url, url1);
			assert.strictEqual(result[1].url, url2);
		});
	});

	describe('blocklists.get()', () => {
		it('should return empty domains when blocklist does not exist', async () => {
			const result = await activitypub.blocklists.get('https://nonexistent.com/blocklist.csv');
			assert.strictEqual(result.domains.length, 0);
			assert.strictEqual(result.count, 0);
		});

		it('should return domains from an existing blocklist', async () => {
			const url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);

			const result = await activitypub.blocklists.get(url);

			assert.strictEqual(result.count, 0);
			assert.strictEqual(result.domains.length, 0);
		});

		it('should return domains after refresh', async () => {
			const url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);

			// Mock the CSV data
			const csvData = '#domain,#severity\nexample.com,1\nexample.org,1';
			const mockResponse = { body: csvData };
			request.get = () => mockResponse;

			await activitypub.blocklists.refresh(url);

			const result = await activitypub.blocklists.get(url);

			assert.strictEqual(result.count, 2);
			assert(result.domains.includes('example.com'));
			assert(result.domains.includes('example.org'));
		});
	});

	describe('blocklists.add()', () => {
		it('should add a new blocklist', async () => {
			const url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);

			const result = await activitypub.blocklists.list();
			assert(result.some(r => r.url === url));
		});

		it('should refresh the blocklist after adding', async () => {
			const url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);

			// Verify the blocklist was added and refreshed
			const result = await activitypub.blocklists.get(url);
			assert.strictEqual(result.count, 2);
		});
	});

	describe('blocklists.remove()', () => {
		it('should remove a blocklist', async () => {
			const url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);

			await activitypub.blocklists.remove(url);

			const result = await activitypub.blocklists.list();
			assert(!result.some(r => r.url === url));
		});

		it('should delete the blocklist data', async () => {
			const url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);
			await activitypub.blocklists.refresh(url);

			await activitypub.blocklists.remove(url);

			const result = await activitypub.blocklists.get(url);
			assert.strictEqual(result.count, 0);
		});
	});

	describe('blocklists.refresh()', () => {
		before(function () {
			this.url = 'https://example.com/blocklist.csv';
		});

		afterEach(async function () {
			await activitypub.blocklists.remove(this.url);
		});

		it('should process a valid CSV', async function () {
			await activitypub.blocklists.add(this.url);

			const csvData = '#domain,#severity\nexample.com,1\nexample.org,2\nsilence.example.com,2';
			const mockResponse = { body: csvData };
			request.get = () => mockResponse;

			const result = await activitypub.blocklists.refresh(this.url);

			assert.strictEqual(result, 3);
		});

		it('should return 0 for empty CSV', async function () {
			await activitypub.blocklists.add(this.url);

			const csvData = '';
			const mockResponse = { body: csvData };
			request.get = () => mockResponse;

			const result = await activitypub.blocklists.refresh(this.url);

			assert.strictEqual(result, 0);
		});

		it('should return 0 on parse error', async function () {
			await activitypub.blocklists.add(this.url);

			const csvData = 'invalid,csv,data';
			const mockResponse = { body: csvData };
			request.get = () => mockResponse;

			const result = await activitypub.blocklists.refresh(this.url);

			assert.strictEqual(result, 0);
		});

		it('should handle severity levels correctly', async function () {
			await activitypub.blocklists.add(this.url);

			const csvData = '#domain,#severity\nexample.com,1\nsilence.example.com,2';
			const mockResponse = { body: csvData };
			request.get = () => mockResponse;

			await activitypub.blocklists.refresh(this.url);

			const result = await activitypub.blocklists.get(this.url);

			assert.strictEqual(result.count, 2);
		});
	});

	describe('blocklists.check()', () => {
		async function clear () {
			const url1 = 'https://example.com/blocklist1.csv';
			const url2 = 'https://example.com/blocklist2.csv';
			const url3 = 'https://example.com/blocklist.csv';
			await Promise.all([url1, url2, url3].map(async (url) => {
				await activitypub.blocklists.remove(url);
			}));
		}
		before(clear);
		afterEach(clear);

		it('should return true when domain is not blocked', async () => {
			const result = await activitypub.blocklists.check('example.com');

			assert.strictEqual(result, true);
		});

		it('should return false when domain is blocked', async () => {
			const url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);

			const csvData = '#domain,#severity\nexample.com,1';
			const mockResponse = { body: csvData };
			request.get = () => mockResponse;

			await activitypub.blocklists.refresh(url);

			const result = await activitypub.blocklists.check('example.com');

			assert.strictEqual(result, false);
		});

		it('should return true when domain is not in any blocklist', async () => {
			const url1 = 'https://example.com/blocklist1.csv';
			const url2 = 'https://example.com/blocklist2.csv';


			const csvData1 = '#domain,#severity\nblocked.com,1';
			const csvData2 = '#domain,#severity\nblocked.org,1';

			const mockResponse1 = { body: csvData1 };
			const mockResponse2 = { body: csvData2 };
			request.get = () => mockResponse1;
			await activitypub.blocklists.add(url1);

			request.get = () => mockResponse2;
			await activitypub.blocklists.add(url2);

			const result = await activitypub.blocklists.check('example.com');

			assert.strictEqual(result, true);
		});

		it('should return false when domain is in any blocklist', async () => {
			const url1 = 'https://example.com/blocklist1.csv';
			const url2 = 'https://example.com/blocklist2.csv';

			const csvData1 = '#domain,#severity\nexample.com,1';
			const csvData2 = '#domain,#severity\nblocked.org,1';

			const mockResponse1 = { body: csvData1 };
			const mockResponse2 = { body: csvData2 };

			request.get = () => mockResponse1;
			await activitypub.blocklists.add(url1);

			request.get = () => mockResponse2;
			await activitypub.blocklists.add(url2);

			const result = await activitypub.blocklists.check('example.com');

			assert.strictEqual(result, false);
		});
	});

	describe('Integration tests', () => {
		let url;

		before(async () => {
			url = 'https://example.com/blocklist.csv';
			await activitypub.blocklists.add(url);
		});

		after(async () => {
			await activitypub.blocklists.remove(url);
		});

		it('should handle full lifecycle of a blocklist', async () => {
			// Add
			await activitypub.blocklists.add(url);
			const list = await activitypub.blocklists.list();
			assert(list.some(r => r.url === url));

			// Refresh with data
			const csvData = '#domain,#severity\nblocked.com,1\nblocked.org,1';
			const mockResponse = { body: csvData };
			request.get = () => mockResponse;

			await activitypub.blocklists.refresh(url);

			// Check
			assert.strictEqual(await activitypub.blocklists.check('blocked.com'), false);
			assert.strictEqual(await activitypub.blocklists.check('allowed.com'), true);

			// Remove
			await activitypub.blocklists.remove(url);

			// Verify removed
			const listAfter = await activitypub.blocklists.list();
			assert(!listAfter.some(r => r.url === url));
		});
	});
});
