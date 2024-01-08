'use strict';

const assert = require('assert');
const { createHash } = require('crypto');
const nconf = require('nconf');

const db = require('./mocks/databasemock');
const slugify = require('../src/slugify');
const utils = require('../src/utils');
const request = require('../src/request');

const meta = require('../src/meta');
const user = require('../src/user');
const privileges = require('../src/privileges');
const activitypub = require('../src/activitypub');

describe('ActivityPub integration', () => {
	before(() => {
		meta.config.activitypubEnabled = 1;
	});

	after(() => {
		delete meta.config.activitypubEnabled;
	});

	describe('WebFinger endpoint', () => {
		let uid;
		let slug;
		const { host } = nconf.get('url_parsed');

		beforeEach(async () => {
			slug = slugify(utils.generateUUID().slice(0, 8));
			uid = await user.create({ username: slug });
		});

		it('should return a 404 Not Found if no user exists by that username', async () => {
			const { response } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct:foobar@${host}`);

			assert(response);
			assert.strictEqual(response.statusCode, 404);
		});

		it('should return a 400 Bad Request if the request is malformed', async () => {
			const { response } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct:foobar`);

			assert(response);
			assert.strictEqual(response.statusCode, 400);
		});

		it('should return 403 Forbidden if the calling user is not allowed to view the user list/profiles', async () => {
			await privileges.global.rescind(['groups:view:users'], 'guests');
			const { response } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct:${slug}@${host}`);

			assert(response);
			assert.strictEqual(response.statusCode, 403);
			await privileges.global.give(['groups:view:users'], 'guests');
		});

		it('should return a valid WebFinger response otherwise', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=acct:${slug}@${host}`);

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

	describe('Helpers', () => {
		describe('.query()', () => {

		});

		describe('.generateKeys()', () => {

		});

		describe('.resolveLocalUid()', () => {
			let uid;
			let slug;

			beforeEach(async () => {
				slug = slugify(utils.generateUUID().slice(0, 8));
				uid = await user.create({ username: slug });
			});

			it('should throw when an invalid input is passed in', async () => {
				await assert.rejects(
					activitypub.helpers.resolveLocalUid('ncl28h3qwhoiclwnevoinw3u'),
					{ message: '[[error:activitypub.invalid-id]]' }
				);
			});

			it('should return null when valid input is passed but does not resolve', async () => {
				const uid = await activitypub.helpers.resolveLocalUid(`acct:foobar@${nconf.get('url_parsed').host}`);
				assert.strictEqual(uid, null);
			});

			it('should resolve to a local uid when given a webfinger-style string', async () => {
				const found = await activitypub.helpers.resolveLocalUid(`acct:${slug}@${nconf.get('url_parsed').host}`);
				assert.strictEqual(found, uid);
			});

			it('should resolve even without the "acct:" prefix', async () => {
				const found = await activitypub.helpers.resolveLocalUid(`${slug}@${nconf.get('url_parsed').host}`);
				assert.strictEqual(found, uid);
			});

			it('should resolve when passed a full URL', async () => {
				const found = await activitypub.helpers.resolveLocalUid(`${nconf.get('url')}/user/${slug}`);
				assert.strictEqual(found, uid);
			});
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
			delete meta.config.activitypubEnabled;

			const { response, body } = await request.get(`${nconf.get('url')}/user/${slug}`, {
				headers: {
					Accept: 'text/html',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.startsWith('<!DOCTYPE html>'));

			meta.config.activitypubEnabled = 1;
		});

		it('should return regular user profile html if Accept header is not ActivityPub-related', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/user/${slug}`, {
				headers: {
					Accept: 'text/html',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.startsWith('<!DOCTYPE html>'));
		});

		it('should return the ActivityPub Actor JSON-LD payload if the correct Accept header is provided', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/user/${slug}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.hasOwnProperty('@context'));
			assert(body['@context'].includes('https://www.w3.org/ns/activitystreams'));
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
			const { response, body } = await request.get(`${nconf.get('url')}/user/${slug}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(response);
			assert.strictEqual(response.statusCode, 200);
			assert(body.hasOwnProperty('@context'));
			assert(body['@context'].includes('https://www.w3.org/ns/activitystreams'));

			['id', 'url', 'followers', 'following', 'inbox', 'outbox'].forEach((prop) => {
				assert(body.hasOwnProperty(prop));
				assert(body[prop]);
			});

			assert.strictEqual(body.id, body.url);
			assert.strictEqual(body.type, 'Person');
		});

		it('should contain a `publicKey` property with a public key', async () => {
			const { response, body } = await request.get(`${nconf.get('url')}/user/${slug}`, {
				headers: {
					Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
			});

			assert(body.hasOwnProperty('publicKey'));
			assert(['id', 'owner', 'publicKeyPem'].every(prop => body.publicKey.hasOwnProperty(prop)));
		});
	});

	describe('http signature signing and verification', () => {
		describe('.sign()', () => {
			let uid;
			let username;

			before(async () => {
				username = utils.generateUUID().slice(0, 10);
				uid = await user.create({ username });
			});

			it('should create a key-pair for a user if the user does not have one already', async () => {
				const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
				await activitypub.sign(uid, endpoint);
				const { publicKey, privateKey } = await db.getObject(`uid:${uid}:keys`);

				assert(publicKey);
				assert(privateKey);
			});

			it('should return an object with date, a null digest, and signature, if no payload is passed in', async () => {
				const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
				const { date, digest, signature } = await activitypub.sign(uid, endpoint);
				const dateObj = new Date(date);

				assert(signature);
				assert(dateObj);
				assert.strictEqual(digest, null);
			});

			it('should also return a digest hash if payload is passed in', async () => {
				const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
				const payload = { foo: 'bar' };
				const { digest } = await activitypub.sign(uid, endpoint, payload);
				const hash = createHash('sha256');
				hash.update(JSON.stringify(payload));
				const checksum = hash.digest('base64');

				assert(digest);
				assert.strictEqual(digest, `sha-256=${checksum}`);
			});
		});

		describe('.verify()', () => {
			let uid;
			let username;
			const baseUrl = nconf.get('relative_path');
			const mockReqBase = {
				method: 'GET',
				// path: ...
				baseUrl,
				headers: {
					// host: ...
					// date: ...
					// signature: ...
					// digest: ...
				},
			};

			before(async () => {
				username = utils.generateUUID().slice(0, 10);
				uid = await user.create({ username });
			});

			it('should return true when the proper signature and relevant headers are passed in', async () => {
				const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
				const path = `/user/${username}/inbox`;
				const signature = await activitypub.sign(uid, endpoint);
				const { host } = nconf.get('url_parsed');
				const req = {
					...mockReqBase,
					...{
						path,
						headers: { ...signature, host },
					},
				};

				const verified = await activitypub.verify(req);
				assert.strictEqual(verified, true);
			});

			it('should return true when a digest is also passed in', async () => {
				const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
				const path = `/user/${username}/inbox`;
				const signature = await activitypub.sign(uid, endpoint, { foo: 'bar' });
				const { host } = nconf.get('url_parsed');
				const req = {
					...mockReqBase,
					...{
						method: 'POST',
						path,
						headers: { ...signature, host },
					},
				};

				const verified = await activitypub.verify(req);
				assert.strictEqual(verified, true);
			});
		});
	});
});
