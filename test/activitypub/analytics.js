'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../../src/database');
const controllers = require('../../src/controllers');
const middleware = require('../../src/middleware');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const analytics = require('../../src/analytics');
const api = require('../../src/api');

describe('Analytics', () => {
	let cid;
	let uid;
	let postData;

	before(async () => {
		nconf.set('runJobs', 1);
		({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
		const remoteUser = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: 'https://example.org/user/foobar',
			url: 'https://example.org/user/foobar',

			type: 'Person',
			name: 'Foo Bar',
			preferredUsername: 'foobar',
			publicKey: {
				id: 'https://example.org/user/foobar#key',
				owner: 'https://example.org/user/foobar',
				publicKeyPem: 'publickey',
			},
		};
		activitypub._cache.set(`0;https://example.org/user/foobar`, remoteUser);
	});

	after(async () => {
		nconf.set('runJobs', undefined);
	});

	beforeEach(async () => {
		uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
		({ postData } = await topics.post({
			uid,
			cid,
			title: utils.generateUUID(),
			content: utils.generateUUID(),
		}));
	});

	it('should record the incoming activity if successfully processed', async () => {
		const id = `https://example.org/activity/${utils.generateUUID()}`;
		await controllers.activitypub.postInbox({
			body: {
				id,
				type: 'Like',
				actor: 'https://example.org/user/foobar',
				object: {
					type: 'Note',
					id: `${nconf.get('url')}/post/${postData.pid}`,
				},
			},
		}, { sendStatus: () => {} });
		const processed = await db.isSortedSetMember('activities:datetime', id);

		assert(processed);
	});

	it('should not process the activity if received again', async () => {
		// Specifically, the controller would update the score, but the request should be caught in middlewares and ignored
		const id = `https://example.org/activity/${utils.generateUUID()}`;
		await controllers.activitypub.postInbox({
			body: {
				id,
				type: 'Like',
				actor: 'https://example.org/user/foobar',
				object: {
					type: 'Note',
					id: `${nconf.get('url')}/post/${postData.pid}`,
				},
			},
		}, { sendStatus: () => {} });

		await middleware.activitypub.assertPayload({
			body: {
				id,
				type: 'Like',
				actor: 'https://example.org/user/foobar',
				object: {
					type: 'Note',
					id: `${nconf.get('url')}/post/${postData.pid}`,
				},
			},
		}, {
			sendStatus: (statusCode) => {
				assert.strictEqual(statusCode, 200);
			},
		});
	});

	it('should increment the last seen time of that domain', async () => {
		const id = `https://example.org/activity/${utils.generateUUID()}`;
		const before = await db.sortedSetScore('instances:lastSeen', 'example.org');
		await controllers.activitypub.postInbox({
			body: {
				id,
				type: 'Like',
				actor: 'https://example.org/user/foobar',
				object: {
					type: 'Note',
					id: `${nconf.get('url')}/post/${postData.pid}`,
				},
			},
		}, { sendStatus: () => {} });

		const after = await db.sortedSetScore('instances:lastSeen', 'example.org');

		assert(before && after);
		assert(before < after);
	});

	it('should increment various metrics', async () => {
		let counters;
		analytics.pause = true;
		({ counters } = analytics.peek());
		const before = { ...counters };
		const id = `https://example.org/activity/${utils.generateUUID()}`;
		await controllers.activitypub.postInbox({
			body: {
				id,
				type: 'Like',
				actor: 'https://example.org/user/foobar',
				object: {
					type: 'Note',
					id: `${nconf.get('url')}/post/${postData.pid}`,
				},
			},
		}, { sendStatus: () => {} });

		({ counters } = analytics.peek());
		const after = { ...counters };

		const metrics = ['activities', 'activities:byType:Like', 'activities:byHost:example.org'];
		metrics.forEach((metric) => {
			before[metric] = before[metric] || 0;
			assert(before.hasOwnProperty(metric) && after.hasOwnProperty(metric), JSON.stringify({ before, after }, null, 2));
			assert(before[metric] < after[metric]);
		});
		analytics.pause = false;
	});
});
