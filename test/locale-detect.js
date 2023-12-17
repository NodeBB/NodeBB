'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const request = require('../src/request');

describe('Language detection', () => {
	it('should detect the language for a guest', async () => {
		await meta.configs.set('autoDetectLang', 1);

		const { body } = await request.get(`${nconf.get('url')}/api/config`, {
			headers: {
				'Accept-Language': 'de-DE,de;q=0.5',
			},
		});
		assert.ok(body);
		assert.strictEqual(body.userLang, 'de');
	});

	it('should do nothing when disabled', async () => {
		await meta.configs.set('autoDetectLang', 0);

		const { body } = await request.get(`${nconf.get('url')}/api/config`, {
			headers: {
				'Accept-Language': 'de-DE,de;q=0.5',
			},
		});

		assert.ok(body);
		assert.strictEqual(body.userLang, 'en-GB');
	});
});
