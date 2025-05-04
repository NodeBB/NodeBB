'use strict';

const assert = require('assert');
const nconf = require('nconf');

const request = require('../../src/request');
const utils = require('../../src/utils');
const user = require('../../src/user');
const slugify = require('../../src/slugify');
const privileges = require('../../src/privileges');

describe('WebFinger endpoint', () => {
	let uid;
	let slug;
	const { host } = nconf.get('url_parsed');

	beforeEach(async () => {
		slug = slugify(utils.generateUUID().slice(0, 8));
		uid = await user.create({ username: slug });
	});

	it('should return a 404 Not Found if no user exists by that username', async () => {
		const { response } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct%3afoobar%40${host}`);

		assert(response);
		assert.strictEqual(response.statusCode, 404);
	});

	it('should return a 400 Bad Request if the request is malformed', async () => {
		const { response } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct%3afoobar`);

		assert(response);
		assert.strictEqual(response.statusCode, 400);
	});

	it('should return 404 Not Found if the calling user is not allowed to view the user list/profiles', async () => {
		await privileges.global.rescind(['groups:view:users'], 'fediverse');
		const { response } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct%3a${slug}%40${host}`);

		assert(response);
		assert.strictEqual(response.statusCode, 404);
		await privileges.global.give(['groups:view:users'], 'fediverse');
	});

	it('should return a valid WebFinger response otherwise', async () => {
		const { response, body } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct%3a${slug}%40${host}`);

		assert(response);
		assert.strictEqual(response.statusCode, 200);

		['subject', 'aliases', 'links'].forEach((prop) => {
			assert(body.hasOwnProperty(prop));
			assert(body[prop]);
		});

		assert.strictEqual(body.subject, `acct:${slug}@${host}`);

		assert(Array.isArray(body.aliases));
		assert([`${nconf.get('url')}/uid/${uid}`, `${nconf.get('url')}/user/${slug}`].every(url => body.aliases.includes(url)));

		assert(Array.isArray(body.links));
	});
});
