'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');

const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const utils = require('../../src/utils');

describe('Topic tools', () => {
	describe('Topic moving', () => {
		let cid1;
		let cid2;
		let tid;
		let uid;

		before(async () => {
			({ cid: cid1 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			({ cid: cid2 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));

			uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			const { topicData } = await topics.post({
				uid,
				cid: cid1,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			tid = topicData.tid;
		});

		it('should not error when moving a topic from one cid to another', async () => {
			await topics.tools.move(tid, {
				cid: cid2,
				uid,
			});
		});

		it('should reflect the topic in the new category', async () => {
			const tids = await categories.getTopicIds({
				uid,
				cid: cid2,
				start: 0,
				stop: 1,
			});

			assert(Array.isArray(tids));
			assert.deepStrictEqual(tids, [String(tid)]);
		});

		it('should NOT reflect the topic in the old category', async () => {
			const tids = await categories.getTopicIds({
				uid,
				cid: cid1,
				start: 0,
				stop: 1,
			});

			assert(Array.isArray(tids));
			assert.deepStrictEqual(tids, []);
		});
	});

	describe('with remote categories', () => {
		let remoteCid;
		let localCid;
		let tid1;
		let tid2;

		before(async () => {
			const helpers = require('../activitypub/helpers');
			({ id: remoteCid } = helpers.mocks.group());
			({ cid: localCid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));

			({ id: tid1 } = helpers.mocks.note({
				audience: remoteCid,
			}));
			const uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			const { topicData } = await topics.post({
				uid,
				cid: localCid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			tid2 = topicData.tid;
		});

		it('should throw when attempting to move a topic from a remote category', async () => {
			assert.rejects(
				topics.tools.move(tid1, {
					cid: localCid,
					uid: 'system',
				}),
				'[[error:cant-move-topic-to-from-remote-categories]]'
			);
		});

		it('should throw when attempting to move a topic to a remote category', async () => {
			assert.rejects(
				topics.tools.move(tid2, {
					cid: remoteCid,
					uid: 'system',
				}),
				'[[error:cant-move-topic-to-from-remote-categories]]'
			);
		});
	});
});