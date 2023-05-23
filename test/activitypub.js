'use strict';

const nconf = require('nconf');
const request = require('request-promise-native');

const db = require('./mocks/databasemock');

describe('ActivityPub integration', () => {
	describe('WebFinger endpoint', () => {
		it('should return a 404 Not Found if no user exists by that username', async () => {
			const response = await request(`${nconf.get('url')}/register/complete`, {
				method: 'post',
				jar,
				json: true,
				followRedirect: false,
				simple: false,
				resolveWithFullResponse: true,
				headers: {
					'x-csrf-token': token,
				},
				form: {
					email: '',
				},
			});
		});
	});
});
