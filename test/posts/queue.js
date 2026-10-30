'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const install = require('../../src/install');
const topics = require('../../src/topics');
const activitypub = require('../../src/activitypub');

const categories = require('../../src/categories');
const posts = require('../../src/posts');
const user = require('../../src/user');
const utils = require('../../src/utils');

describe('Post Queue', () => {
	let uid;
	let cid;

	before(async () => {
		uid = await user.create({
			username: 'queue test user',
			password: 'testpassword',
		});

		({ cid } = await categories.create({
			name: 'Queue Test Category',
			description: 'Test category for queue tests',
		}));
	});

	describe('addToQueue deduplication by pid', () => {
		afterEach(async () => {
			const queue = await posts.getQueuedPosts();
			await Promise.all(queue.map(q => posts.removeFromQueue(q.id)));
		});
		it('should replace existing queue item when same pid is queued again', async () => {
			const pid = 'https://example.org/post/1';

			await posts.addToQueue({
				uid,
				cid,
				pid,
				title: 'first',
				timestamp: Date.now(),
				content: utils.generateUUID(),
			});

			const queue1 = await posts.getQueuedPosts();
			assert.strictEqual(queue1.length, 1);
			const firstId = queue1[0].id;

			await posts.addToQueue({
				uid,
				cid,
				pid,
				title: 'second',
				timestamp: Date.now(),
				content: utils.generateUUID(),
			});

			const queue2 = await posts.getQueuedPosts();
			assert.strictEqual(queue2.length, 1);
			assert.notStrictEqual(queue2[0].id, firstId);
			assert.strictEqual(queue2[0].data.title, 'second');
		});

		it('should allow different pids to coexist in the queue', async () => {
			await posts.addToQueue({
				uid,
				cid,
				pid: 'https://example.org/post/a',
				title: 'post a',
				timestamp: Date.now(),
				content: utils.generateUUID(),
			});

			await posts.addToQueue({
				uid,
				cid,
				pid: 'https://example.org/post/b',
				title: 'post b',
				timestamp: Date.now(),
				content: utils.generateUUID(),
			});

			const queue = await posts.getQueuedPosts();
			assert.strictEqual(queue.length, 2);
		});

		it('should not deduplicate items without a pid', async () => {
			await posts.addToQueue({
				uid,
				cid,
				title: 'no pid 1',
				timestamp: Date.now(),
				content: utils.generateUUID(),
			});

			await posts.addToQueue({
				uid,
				cid,
				title: 'no pid 2',
				timestamp: Date.now(),
				content: utils.generateUUID(),
			});

			const queue = await posts.getQueuedPosts();
			assert.strictEqual(queue.length, 2);
		});
	});

	describe('submitFromQueue opportunistic backfill', () => {
		let originalBackfill;

		before(async () => {
			meta.config.activitypubEnabled = 1;
			await install.giveWorldPrivileges();
		});

		beforeEach(() => {
			originalBackfill = activitypub.notes.backfill;
		});

		afterEach(async () => {
			activitypub.notes.backfill = originalBackfill;
			const queue = await posts.getQueuedPosts();
			await Promise.all(queue.map(q => posts.removeFromQueue(q.id)));
		});

		it('should trigger backfill for remote topics on approval', async () => {
			const remotePid = 'https://example.org/post/remote-1';
			let backfillCalled = false;
			let backfillArg;
			activitypub.notes.backfill = async (pid) => {
				backfillCalled = true;
				backfillArg = pid;
			};

			await posts.addToQueue({
				uid,
				cid,
				pid: remotePid,
				title: 'Remote topic',
				timestamp: Date.now(),
				content: '<p>remote content</p>',
			});

			const queue = await posts.getQueuedPosts();
			assert.strictEqual(queue.length, 1);

			const result = await posts.submitFromQueue(queue[0].id);

			// Wait for setImmediate to fire
			await new Promise(resolve => setImmediate(resolve));

			assert.ok(result.tid, 'topic was created');
			const mainPid = await topics.getTopicField(result.tid, 'mainPid');
			assert.ok(mainPid, 'topic has mainPid');
			assert.ok(!utils.isNumber(mainPid), 'mainPid is remote');
			assert.ok(backfillCalled, 'backfill was called');
			assert.strictEqual(backfillArg, mainPid, 'backfill was called with mainPid');
		});

		it('should not trigger backfill for local topics on approval', async () => {
			let backfillCalled = false;
			activitypub.notes.backfill = async () => {
				backfillCalled = true;
			};

			await posts.addToQueue({
				uid,
				cid,
				title: 'Local topic',
				timestamp: Date.now(),
				content: '<p>local content</p>',
			});

			const queue = await posts.getQueuedPosts();
			assert.strictEqual(queue.length, 1);

			const result = await posts.submitFromQueue(queue[0].id);

			// Wait for setImmediate to fire
			await new Promise(resolve => setImmediate(resolve));

			assert.ok(result.tid, 'topic was created');
			const mainPid = await topics.getTopicField(result.tid, 'mainPid');
			assert.ok(utils.isNumber(mainPid), 'mainPid is local');
			assert.ok(!backfillCalled, 'backfill was not called for local topic');
		});
	});
});
