'use strict';

const assert = require('assert');
const db = require('./mocks/databasemock');
const request = require('../src/request');

describe('request', function () {
	it('should properly load spam data from stopforumspam api', async () => {
		const { response, body } = await request.get('https://api.stopforumspam.org/api?json&email=testing@xrumer.com', {
			headers: {
				'User-Agent': 'NodeBB Test Suite',
			},
		});
		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(body.success, 1);
		assert(body.email.appears > 0);
	});
});