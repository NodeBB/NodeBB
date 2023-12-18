'use strict';

const assert = require('assert');
const tough = require('tough-cookie');

const makeFetchCookie = require('fetch-cookie');

const { Cookie, CookieJar } = tough;

const nconf = require('nconf');

const db = require('./mocks/databasemock');
const user = require('../src/user');
const groups = require('../src/groups');

describe('fetch', () => {
	let adminUid;
	const baseUrl = nconf.get('url');
	console.log('baseurl', baseUrl);

	before(async () => {
		adminUid = await user.create({ username: 'admin', password: '123456' });
		groups.join('administrators', adminUid);
	});


	it('should login with fetch-cooki', async () => {
		const jar = new CookieJar();
		const fetchCookie = makeFetchCookie(fetch, jar);

		const response = await fetchCookie(`${baseUrl}/api/config`);
		const crsf_token = (await response.json()).csrf_token;
		console.log('token', crsf_token);

		const loginResponse = await fetchCookie(`${baseUrl}/login`, {
			method: 'post',
			body: JSON.stringify({
				username: 'admin',
				password: '123456',
			}),
			headers: {
				'Content-Type': 'application/json',
				'x-csrf-token': config.csrf_token,
				cookie: cookie.toString(),
			},
		});
		if (loginResponse.ok) {
			cookie = Cookie.parse(loginResponse.headers.getSetCookie()[0]);
			await jar.setCookie(cookie, baseUrl);
			console.log('get cookies result', await jar.getCookieString(baseUrl));
			console.log('login', await loginResponse.json());
			console.log('jar idx', jar);
		} else {
			console.log('login err', await loginResponse.text());
		}

		const r = await fetch(`${baseUrl}/api/user/admin/settings`, {
			headers: {
				'Content-Type': 'application/json',
				cookie: await jar.getCookieString(baseUrl),
			},
		});
		// console.log(await r.json());
	});


	// it('should load csrf token', async () => {
	// 	const jar = new CookieJar();

	// 	const response = await fetch(`${baseUrl}/api/config`);
	// 	let cookie = Cookie.parse(response.headers.getSetCookie()[0]);

	// 	await jar.setCookie(cookie, baseUrl);


	// 	const config = await response.json();
	// 	assert(config.csrf_token);
	// 	// console.log('text', await response.json());

	// 	const loginResponse = await fetch(`${baseUrl}/login`, {
	// 		method: 'post',
	// 		body: JSON.stringify({
	// 			username: 'admin',
	// 			password: '123456',
	// 		}),
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			'x-csrf-token': config.csrf_token,
	// 			cookie: cookie.toString(),
	// 		},
	// 	});
	// 	if (loginResponse.ok) {
	// 		cookie = Cookie.parse(loginResponse.headers.getSetCookie()[0]);
	// 		await jar.setCookie(cookie, baseUrl);
	// 		console.log('get cookies result', await jar.getCookieString(baseUrl));
	// 		console.log('login', await loginResponse.json());
	// 		console.log('jar idx', jar);
	// 	} else {
	// 		console.log('login err', await loginResponse.text());
	// 	}

	// 	const r = await fetch(`${baseUrl}/api/user/admin/settings`, {
	// 		headers: {
	// 			'Content-Type': 'application/json',
	// 			cookie: await jar.getCookieString(baseUrl),
	// 		},
	// 	});
	// 	// console.log(await r.json());
	// });
});
