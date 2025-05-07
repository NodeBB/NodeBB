import assert from 'assert';
import nconf from 'nconf';

import './mocks/databasemock.mjs';
import meta from '../src/meta/index.js';
import request from '../src/request.js';

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