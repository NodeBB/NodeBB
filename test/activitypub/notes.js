'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const install = require('../../src/install');
const user = require('../../src/user');
const categories = require('../../src/categories');
const posts = require('../../src/posts');
const topics = require('../../src/topics');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

const helpers = require('./helpers');

describe('Notes', () => {
	describe('Assertion', () => {
		before(async () => {
			meta.config.activitypubEnabled = 1;
			await install.giveWorldPrivileges();
		});

		describe('Public objects', () => {
			it('should pull a remote root-level object by its id and create a new topic', async () => {
				const { id } = helpers.mocks.note();
				const assertion = await activitypub.notes.assert(0, id, { skipChecks: true });
				assert(assertion);

				const { tid, count } = assertion;
				assert(tid);
				assert.strictEqual(count, 1);

				const exists = await topics.exists(tid);
				assert(exists);
			});

			it('should assert if the cc property is missing', async () => {
				const { id } = helpers.mocks.note({ cc: 'remove' });
				const assertion = await activitypub.notes.assert(0, id, { skipChecks: true });
				assert(assertion);

				const { tid, count } = assertion;
				assert(tid);
				assert.strictEqual(count, 1);

				const exists = await topics.exists(tid);
				assert(exists);
			});

			it('should assert if the object is of type Video', async () => {
				const { id } = helpers.mocks.note({
					type: 'Video',
				});
				const assertion = await activitypub.notes.assert(0, id, { skipChecks: true });
				assert(assertion);

				const { tid, count } = assertion;
				assert(tid);
				assert.strictEqual(count, 1);

				const exists = await topics.exists(tid);
				assert(exists);
			});
		});

		describe('Private objects', () => {
			let recipientUid;

			before(async () => {
				recipientUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			});

			it('should NOT create a new topic or post when asserting a private note', async () => {
				const { id, note } = helpers.mocks.note({
					to: [`${nconf.get('url')}/uid/${recipientUid}`],
					cc: [],
				});
				const { activity } = helpers.mocks.create(note);
				const { roomId } = await activitypub.inbox.create({ body: activity });
				assert(roomId);
				assert(utils.isNumber(roomId));

				const exists = await posts.exists(id);
				assert(!exists);
			});

			it('should still assert if the cc property is missing', async () => {
				const { id, note } = helpers.mocks.note({
					to: [`${nconf.get('url')}/uid/${recipientUid}`],
					cc: 'remove',
				});
				const { activity } = helpers.mocks.create(note);
				const { roomId } = await activitypub.inbox.create({ body: activity });
				assert(roomId);
				assert(utils.isNumber(roomId));
			});
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
