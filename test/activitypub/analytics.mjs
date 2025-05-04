import nconf from 'nconf';
import assert from 'assert';
import { strict as assertStrict } from 'assert';

import * as db from '../../src/database.js';
import * as controllers from '../../src/controllers.js';
import * as middleware from '../../src/middleware.js';
import * as activitypub from '../../src/activitypub.js';
import * as utils from '../../src/utils.js';
import * as user from '../../src/user.js';
import * as categories from '../../src/categories.js';
import * as topics from '../../src/topics.js';
import * as analytics from '../../src/analytics.js';
import * as api from '../../src/api.js';

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