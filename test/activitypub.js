'use strict';

const assert = require('assert');
const nconf = require('nconf');
const request = require('request-promise-native');

const db = require('./mocks/databasemock');
const slugify = require('../src/slugify');
const utils = require('../src/utils');

const meta = require('../src/meta');
const user = require('../src/user');
const privileges = require('../src/privileges');

describe('ActivityPub integration', () => {
	before(() => {
		meta.config.activityPubEnabled = 1;
	});

	after(() => {
		delete meta.config.activityPubEnabled;
	});

	describe('WebFinger endpoint', () => {
		let uid;
		let slug;
		const { hostname } = nconf.get('url_parsed');

		beforeEach(async () => {
			slug = slugify(utils.generateUUID().slice(0, 8));
			uid = await user.create({ username: slug });
		});

		it('should return a 404 Not Found if no user exists by that username', async () => {
			const response = await request(`${nconf.get('url')}/.well-known/webfinger?resource=acct:foobar@${hostname}`, {
				method: 'get',
				json: true,
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
			});

			assert(response);
			assert.strictEqual(response.statusCode, 404);
		});

		it('should return a 400 Bad Request if the request is malformed', async () => {
			const response = await request(`${nconf.get('url')}/.well-known/webfinger?resource=acct:foobar`, {
				method: 'get',
				json: true,
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
			});

			assert(response);
			assert.strictEqual(response.statusCode, 400);
		});

		it('should return 403 Forbidden if the calling user is not allowed to view the user list/profiles', async () => {
			await privileges.global.rescind(['groups:view:users'], 'guests');
			const response = await request(`${nconf.get('url')}/.well-known/webfinger?resource=acct:${slug}@${hostname}`, {
				method: 'get',
				json: true,
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
			});

			assert(response);
			assert.strictEqual(response.statusCode, 403);
			await privileges.global.give(['groups:view:users'], 'guests');
		});

		it('should return a valid WebFinger response otherwise', async () => {
			const response = await request(`${nconf.get('url')}/.well-known/webfinger?resource=acct:${slug}@${hostname}`, {
				method: 'get',
				json: true,
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);

			['subject', 'aliases', 'links'].forEach((prop) => {
				assert(response.body.hasOwnProperty(prop));
				assert(response.body[prop]);
			});

			assert.strictEqual(response.body.subject, `acct:${slug}@${hostname}`);

			assert(Array.isArray(response.body.aliases));
			assert([`${nconf.get('url')}/uid/${uid}`, `${nconf.get('url')}/user/${slug}`].every(url => response.body.aliases.includes(url)));

			assert(Array.isArray(response.body.links));
		});
	});

	describe('ActivityPub screener middleware', () => {
		let uid;
		let slug;

		beforeEach(async () => {
			slug = slugify(utils.generateUUID().slice(0, 8));
			uid = await user.create({ username: slug });
		});

		it('should return regular user profile html if federation is disabled', async () => {
			delete meta.config.activityPubEnabled;

			const response = await request(`${nconf.get('url')}/user/${slug}`, {
				method: 'get',
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
				headers: {
					Accept: 'text/html',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(response.body.startsWith('<!DOCTYPE html>'));

			meta.config.activityPubEnabled = 1;
		});

		it('should return regular user profile html if Accept header is not ActivityPub-related', async () => {
			const response = await request(`${nconf.get('url')}/user/${slug}`, {
				method: 'get',
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
				headers: {
					Accept: 'text/html',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(response.body.startsWith('<!DOCTYPE html>'));
		});

		it('should return the ActivityPub Actor JSON-LD payload if the correct Accept header is provided', async () => {
			const response = await request(`${nconf.get('url')}/user/${slug}`, {
				method: 'get',
				json: true,
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(response.body.hasOwnProperty('@context'));
			assert(response.body['@context'].includes('https://www.w3.org/ns/activitystreams'));
		});
	});

	describe('Actor endpoint', () => {
		let uid;
		let slug;

		beforeEach(async () => {
			slug = slugify(utils.generateUUID().slice(0, 8));
			uid = await user.create({ username: slug });
		});

		it('should return a valid ActivityPub Actor JSON-LD payload', async () => {
			const response = await request(`${nconf.get('url')}/user/${slug}`, {
				method: 'get',
				json: true,
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(response.body.hasOwnProperty('@context'));
			assert(response.body['@context'].includes('https://www.w3.org/ns/activitystreams'));

			['id', 'url', 'followers', 'following', 'inbox', 'outbox'].forEach((prop) => {
				assert(response.body.hasOwnProperty(prop));
				assert(response.body[prop]);
			});

			assert.strictEqual(response.body.id, response.body.url);
			assert.strictEqual(response.body.type, 'Person');
		});

		it('should contain a `publicKey` property with a public key', async () => {
			const response = await request(`${nconf.get('url')}/user/${slug}`, {
				method: 'get',
				json: true,
				followRedirect: true,
				simple: false,
				resolveWithFullResponse: true,
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response.body.hasOwnProperty('publicKey'));
			assert(['id', 'owner', 'publicKeyPem'].every(prop => response.body.publicKey.hasOwnProperty(prop)));
		});
	});
});
