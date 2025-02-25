'use strict';

const assert = require('assert');

const db = require('../../src/database');
const meta = require('../../src/meta');
const install = require('../../src/install');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

describe('Notes', () => {
	describe('Assertion', () => {
		const baseUrl = 'https://example.org';

		before(async () => {
			meta.config.activitypubEnabled = 1;
			await install.giveWorldPrivileges();
		});

		it('should pull a remote root-level object by its id and create a new topic', async () => {
			const uuid = utils.generateUUID();
			const id = `${baseUrl}/resource/${uuid}`;
			activitypub._cache.set(`0;${id}`, {
				'@context': 'https://www.w3.org/ns/activitystreams',
				id,
				url: id,
				type: 'Note',
				to: ['https://www.w3.org/ns/activitystreams#Public'],
				cc: ['https://example.org/user/foobar/followers'],
				inReplyTo: null,
				attributedTo: 'https://example.org/user/foobar',
				name: 'Foo Bar',
				content: '<b>Baz quux</b>',
				published: new Date().toISOString(),
			});

			const { tid, count } = await activitypub.notes.assert(0, id, { skipChecks: true });
			assert.strictEqual(count, 1);

			const exists = await topics.exists(tid);
			assert(exists);
		});

		it('should assert if the cc property is missing', async () => {
			const uuid = utils.generateUUID();
			const id = `${baseUrl}/resource/${uuid}`;
			activitypub._cache.set(`0;${id}`, {
				'@context': 'https://www.w3.org/ns/activitystreams',
				id,
				url: id,
				type: 'Note',
				to: ['https://www.w3.org/ns/activitystreams#Public'],
				inReplyTo: null,
				attributedTo: 'https://example.org/user/foobar',
				name: 'Foo Bar',
				content: '<b>Baz quux</b>',
				published: new Date().toISOString(),
			});

			const { tid, count } = await activitypub.notes.assert(0, id, { skipChecks: true });
			assert.strictEqual(count, 1);

			const exists = await topics.exists(tid);
			assert(exists);
		});
	});

	describe('Inbox Synchronization', () => {
		let cid;
		let uid;
		let topicData;

		before(async () => {
			({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
		});

		beforeEach(async () => {
			uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			({ topicData } = await topics.post({
				cid,
				uid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			}));
		});

		it('should add a topic to a user\'s inbox if user is a recipient in OP', async () => {
			await db.setAdd(`post:${topicData.mainPid}:recipients`, [uid]);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, true);
		});

		it('should add a topic to a user\'s inbox if a user is a recipient in a reply', async () => {
			const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			const { pid } = await topics.reply({
				tid: topicData.tid,
				uid,
				content: utils.generateUUID(),
			});
			await db.setAdd(`post:${pid}:recipients`, [uid]);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, true);
		});

		it('should maintain a list of recipients at the topic level', async () => {
			await db.setAdd(`post:${topicData.mainPid}:recipients`, [uid]);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const [isRecipient, count] = await Promise.all([
				db.isSetMember(`tid:${topicData.tid}:recipients`, uid),
				db.setCount(`tid:${topicData.tid}:recipients`),
			]);

			assert(isRecipient);
			assert.strictEqual(count, 1);
		});

		it('should add topic to a user\'s inbox if it is explicitly passed in as an argument', async () => {
			await activitypub.notes.syncUserInboxes(topicData.tid, uid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, true);
		});

		it('should remove a topic from a user\'s inbox if that user is no longer a recipient in any contained posts', async () => {
			await activitypub.notes.syncUserInboxes(topicData.tid, uid);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, false);
		});
	});

	describe('Deletion', () => {
		let cid;
		let uid;
		let topicData;

		before(async () => {
			({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
		});

		beforeEach(async () => {
			uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			({ topicData } = await topics.post({
				cid,
				uid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			}));
		});

		it('should clean up recipient sets for the post', async () => {
			const { pid } = await topics.reply({
				pid: `https://example.org/${utils.generateUUID().slice(0, 8)}`,
				tid: topicData.tid,
				uid,
				content: utils.generateUUID(),
			});
			await db.setAdd(`post:${pid}:recipients`, [uid]);
			await activitypub.notes.delete([pid]);

			const inboxed = await db.isSetMember(`post:${pid}:recipients`, uid);
			assert(!inboxed);
		});
	});
});
