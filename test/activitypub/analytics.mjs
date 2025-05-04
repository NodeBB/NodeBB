import nconf from 'nconf';
import assert from 'assert';
import { strict as assertStrict } from 'assert';

import db from '../mocks/databasemock.mjs';
import controllers from '../../src/controllers/index.js';
import middleware from '../../src/middleware/index.js';
import activitypub from '../../src/activitypub/index.js';
import utils from '../../src/utils.js';
import user from '../../src/user/index.js';
import categories from '../../src/categories/index.js';
import topics from '../../src/topics/index.js';
import analytics from '../../src/analytics.js';

describe('ActivityPub/Analytics', () => {
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
		}, { sendStatus: () => { } });
		const processed = await db.isSortedSetMember('activities:datetime', id);

		assert(processed);
	});

	it('should not process the activity if received again', async () => {
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
		}, { sendStatus: () => { } });

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
				assertStrict.strictEqual(statusCode, 200);
			},
		});
	});

	it('should increment the last seen time of that domain', async () => {
		const id = `https://example.org/activity/${utils.generateUUID()}`;
		const before = await db.sortedSetScore('domains:lastSeen', 'example.org');
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
		}, { sendStatus: () => { } });

		const after = await db.sortedSetScore('domains:lastSeen', 'example.org');

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
		}, { sendStatus: () => { } });

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