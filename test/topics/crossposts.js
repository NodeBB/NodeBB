'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');

const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const utils = require('../../src/utils');

describe('Crossposting (& related logic)', () => {
	describe('topic already in multiple categories', () => {
		let tid;
		let cid1;
		let cid2;
		let uid;

		before(async () => {
			({ cid: cid1 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			const { topicData } = await topics.post({
				uid,
				cid: cid1,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			tid = topicData.tid;

			// Add topic to another category's zset
			const crosspostCategory = await categories.create({ name: utils.generateUUID().slice(0, 8) });
			cid2 = crosspostCategory.cid;
			await db.sortedSetAdd(`cid:${crosspostCategory.cid}:tids`, topicData.timestamp, tid);
		});

		it('should contain the topic in both categories when requested', async () => {
			const tids1 = await categories.getTopicIds({
				uid,
				cid: cid1,
				start: 0,
				stop: 1,
			});

			const tids2 = await categories.getTopicIds({
				uid,
				cid: cid2,
				start: 0,
				stop: 1,
			});

			assert.deepStrictEqual(tids1, tids2);
		});
	});

	describe('crosspost', () => {
		let tid;
		let cid1;
		let cid2;
		let uid;

		before(async () => {
			({ cid: cid1 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			const crosspostCategory = await categories.create({ name: utils.generateUUID().slice(0, 8) });
			cid2 = crosspostCategory.cid;
			uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			const { topicData } = await topics.post({
				uid,
				cid: cid1,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			tid = topicData.tid;
		});

		it('should successfully crosspost to another cid', async () => {
			const crossposts = await topics.crossposts.add(tid, cid2, uid);

			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 1);
			assert.partialDeepStrictEqual(crossposts[0], {
				uid,
				tid,
				cid: cid2,
			});
		});

		it('should show the tid in both categories when requested', async () => {
			const tids1 = await categories.getTopicIds({
				uid,
				cid: cid1,
				start: 0,
				stop: 1,
			});

			const tids2 = await categories.getTopicIds({
				uid,
				cid: cid2,
				start: 0,
				stop: 1,
			});

			assert.deepStrictEqual(tids1, tids2);
		});

		it('should throw on cross-posting again when already cross-posted', async () => {
			await assert.rejects(
				topics.crossposts.add(tid, cid2, uid),
				{ message: '[[error:topic-already-crossposted]]' },
			);
		});
	});

	describe('uncrosspost', () => {
		let tid;
		let cid1;
		let cid2;
		let uid;

		before(async () => {
			({ cid: cid1 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			const crosspostCategory = await categories.create({ name: utils.generateUUID().slice(0, 8) });
			cid2 = crosspostCategory.cid;
			uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			const { topicData } = await topics.post({
				uid,
				cid: cid1,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			tid = topicData.tid;

			await topics.crossposts.add(tid, cid2, uid);
		});

		it('should successfully uncrosspost from a cid', async () => {
			const crossposts = await topics.crossposts.remove(tid, cid2, uid);

			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 0);
		});

		it('should not contain the topic in the category the topic was uncrossposted from', async () => {
			const tids = await categories.getTopicIds({
				uid,
				cid: cid2,
				start: 0,
				stop: 1,
			});

			assert(!tids.includes(tid));
		});

		it('should throw on uncrossposting if already uncrossposted', async () => {
			assert.rejects(
				topics.crossposts.remove(tid, cid2, uid),
				'[[error:invalid-data]]',
			);
		});
	});
});