'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const request = require('../../src/request');
const utils = require('../../src/utils');
const user = require('../../src/user');
const slugify = require('../../src/slugify');
const privileges = require('../../src/privileges');
const meta = require('../../src/meta');
const install = require('../../src/install');
const activitypub = require('../../src/activitypub');

const helpers = require('./helpers');

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

describe('WebFinger endpoint: unicode (internationalized) handles', () => {
	const { host } = nconf.get('url_parsed');

	// Unique unicode username per test: a unicode prefix (the char under test) plus a
	// UUID suffix so repeated tests don't collide on the in-memory DB (which persists
	// across tests within a describe block).
	const unicodeName = (prefix) => `${prefix}${utils.generateUUID().slice(0, 8)}`;

	it('should preserve an accented (non-ASCII) username in the userslug', async () => {
		const username = unicodeName('josé');
		const uid = await user.create({ username });
		const userslug = await user.getUserField(uid, 'userslug');

		assert.strictEqual(userslug, slugify(username));
		assert(userslug.startsWith('josé'));
	});

	it('should preserve a CJK (non-Latin) username in the userslug', async () => {
		const username = unicodeName('用户');
		const uid = await user.create({ username });
		const userslug = await user.getUserField(uid, 'userslug');

		assert.strictEqual(userslug, slugify(username));
		assert(userslug.startsWith('用户'));
	});

	it('should return a faithful unicode subject for an accented handle', async () => {
		const username = unicodeName('josé');
		await user.create({ username });
		const slug = slugify(username);
		const { response, body } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${slug}@${host}`)}`);

		assert.strictEqual(response.statusCode, 200);
		// subject must retain the actual unicode char, not an ASCII-mangled form
		assert.strictEqual(body.subject, `acct:${slug}@${host}`);
		assert(body.subject.includes('é'));
	});

	it('should return a faithful unicode subject for a CJK handle', async () => {
		const username = unicodeName('用户');
		await user.create({ username });
		const slug = slugify(username);
		const { response, body } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${slug}@${host}`)}`);

		assert.strictEqual(response.statusCode, 200);
		assert.strictEqual(body.subject, `acct:${slug}@${host}`);
		assert(body.subject.includes('用户'));
	});

	it('should include the unicode slug in the profile aliases', async () => {
		const username = unicodeName('josé');
		const uid = await user.create({ username });
		const slug = slugify(username);
		const { response, body } = await request.get(`${nconf.get('url')}/.well-known/webfinger?resource=${encodeURIComponent(`acct:${slug}@${host}`)}`);

		assert.strictEqual(response.statusCode, 200);
		assert(body.aliases.includes(`${nconf.get('url')}/uid/${uid}`));
		assert(body.aliases.includes(`${nconf.get('url')}/user/${slug}`));
	});
});

describe('Asserting incoming unicode (internationalized) handles', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		meta.config.activitypubAllowLoopback = 1;
		await install.giveWorldPrivileges();

		// Prevent real outbound requests (serve objects from the AP cache)
		helpers.mocks.mockRequests();
	});

	after(() => {
		helpers.mocks.restoreRequests();
	});

	it('should assert a remote actor addressed by an accented (non-ASCII) handle', async () => {
		const preferredUsername = 'josé';
		const { id } = helpers.mocks.person({ preferredUsername });

		const result = await activitypub.actors.assert([`${preferredUsername}@example.org`]);
		assert(result && result.length);
		assert.strictEqual(result[0].id, id);
	});

	it('should store the accented handle-to-uid association with the unicode char intact', async () => {
		const preferredUsername = 'josé';
		const { id } = helpers.mocks.person({ preferredUsername });
		await activitypub.actors.assert([`${preferredUsername}@example.org`]);

		const storedUid = await db.getObjectField('handle:uid', `${preferredUsername.toLowerCase()}@example.org`);
		assert.strictEqual(storedUid, id);
	});

	it('should create a remote user representation for the accented handle', async () => {
		const preferredUsername = 'josé';
		const { id } = helpers.mocks.person({ preferredUsername });
		await activitypub.actors.assert([`${preferredUsername}@example.org`]);

		assert(await db.exists(`userRemote:${id}`));
	});

	it('should assert a remote actor addressed by a CJK (non-Latin) handle', async () => {
		const preferredUsername = '用户';
		const { id } = helpers.mocks.person({ preferredUsername });

		const result = await activitypub.actors.assert([`${preferredUsername}@example.org`]);
		assert(result && result.length);
		assert.strictEqual(result[0].id, id);

		const storedUid = await db.getObjectField('handle:uid', `${preferredUsername}@example.org`);
		assert.strictEqual(storedUid, id);
	});
});
