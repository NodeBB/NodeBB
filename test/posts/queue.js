'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');

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
});
