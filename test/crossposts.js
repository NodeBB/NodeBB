'use strict';

const assert = require('assert');

const db = require('./mocks/databasemock');
const topics = require('../src/topics');
const categories = require('../src/categories');
const privileges = require('../src/privileges');
const User = require('../src/user');
const groups = require('../src/groups');

describe('Crossposts', () => {
	let uid;
	let adminUid;
	let sourceCategory;
	let targetCategory;

	before(async () => {
		uid = await User.create({ username: 'crossposter', password: '123456' });
		adminUid = await User.create({ username: 'crosspost-admin', password: '123456' });
		await groups.join('administrators', adminUid);
		sourceCategory = await categories.create({ name: 'crosspost source' });
		targetCategory = await categories.create({ name: 'crosspost target' });
		await privileges.categories.give(['groups:topics:crosspost'], targetCategory.cid, 'registered-users');
	});

	async function createTopic(data) {
		const { topicData } = await topics.post({
			uid,
			cid: sourceCategory.cid,
			title: 'crosspost test topic',
			content: 'the content of the crosspost test topic',
			...data,
		});
		return topicData;
	}

	it('should crosspost a pinned topic', async () => {
		const { tid } = await createTopic();
		await topics.tools.pin(tid, adminUid);

		await topics.crossposts.add(tid, targetCategory.cid, uid);

		const [pinnedScore, tidsScore] = await Promise.all([
			db.sortedSetScore(`cid:${targetCategory.cid}:tids:pinned`, tid),
			db.sortedSetScore(`cid:${targetCategory.cid}:tids`, tid),
		]);
		assert(pinnedScore, 'crossposted pinned topic should be in the destination pinned set');
		assert.strictEqual(tidsScore, null, 'a pinned topic should not be in the destination topic set');
	});

	it('should index the topic\'s tags in the destination category', async () => {
		const { tid } = await createTopic({ tags: ['crosspost-tag'] });
		await topics.crossposts.add(tid, targetCategory.cid, uid);

		const score = await db.sortedSetScore(`cid:${targetCategory.cid}:tag:crosspost-tag:topics`, tid);
		assert(score, 'crossposted topic should be listed under its tags in the destination category');

		await topics.crossposts.remove(tid, targetCategory.cid, uid);
		const scoreAfter = await db.sortedSetScore(`cid:${targetCategory.cid}:tag:crosspost-tag:topics`, tid);
		assert.strictEqual(scoreAfter, null, 'tag index should be cleaned up when the crosspost is removed');
	});

	it('should pin a crossposted topic in its crossposted categories too', async () => {
		const { tid } = await createTopic();
		await topics.crossposts.add(tid, targetCategory.cid, uid);

		await topics.tools.pin(tid, adminUid);

		const [pinnedScore, tidsScore] = await Promise.all([
			db.sortedSetScore(`cid:${targetCategory.cid}:tids:pinned`, tid),
			db.sortedSetScore(`cid:${targetCategory.cid}:tids`, tid),
		]);
		assert(pinnedScore, 'pinning should reach the crossposted category');
		assert.strictEqual(tidsScore, null, 'a pinned topic should not be left in the crossposted topic set');
	});

	it('should unpin a crossposted topic in its crossposted categories too', async () => {
		const { tid } = await createTopic();
		await topics.tools.pin(tid, adminUid);
		await topics.crossposts.add(tid, targetCategory.cid, uid);

		await topics.tools.unpin(tid, adminUid);

		const [pinnedScore, tidsScore] = await Promise.all([
			db.sortedSetScore(`cid:${targetCategory.cid}:tids:pinned`, tid),
			db.sortedSetScore(`cid:${targetCategory.cid}:tids`, tid),
		]);
		assert.strictEqual(pinnedScore, null, 'unpinning should clear the crossposted pinned set');
		assert(tidsScore, 'an unpinned topic should be back in the crossposted topic set');
	});

	it('should bump the topic in crossposted categories when it is replied to', async () => {
		const { tid } = await createTopic();
		await topics.crossposts.add(tid, targetCategory.cid, uid);

		const before = await db.sortedSetScore(`cid:${targetCategory.cid}:tids`, tid);
		const { timestamp } = await topics.reply({ uid, tid, content: 'a reply to bump the topic' });

		const after = await db.sortedSetScore(`cid:${targetCategory.cid}:tids`, tid);
		assert(after > before, 'reply should bump the topic in the crossposted category');
		assert.strictEqual(after, timestamp);
	});

	it('should reconcile stale post, vote and view scores in crossposted categories', async () => {
		const { tid } = await createTopic();
		await topics.crossposts.add(tid, targetCategory.cid, uid);

		// posts/votes/views are only ever written for the topic's own category,
		// so stand in for the drift that accumulates there
		await db.sortedSetAddBulk([
			[`cid:${targetCategory.cid}:tids:posts`, 0, tid],
			[`cid:${targetCategory.cid}:tids:votes`, -5, tid],
			[`cid:${targetCategory.cid}:tids:views`, 0, tid],
		]);

		const [crossposts, topicData] = await Promise.all([
			topics.crossposts.get(tid),
			topics.getTopicData(tid),
		]);
		await topics.crossposts.syncCrosspostedTopicCids(crossposts, topicData);

		const scores = await db.sortedSetsScore([
			`cid:${targetCategory.cid}:tids:posts`,
			`cid:${targetCategory.cid}:tids:votes`,
			`cid:${targetCategory.cid}:tids:views`,
		], tid);
		assert.deepStrictEqual(scores, [topicData.postcount, topicData.votes, topicData.viewcount]);
	});

	it('should leave a pinned topic out of the reconciled zsets', async () => {
		const { tid } = await createTopic();
		await topics.tools.pin(tid, adminUid);
		await topics.crossposts.add(tid, targetCategory.cid, uid);

		const [crossposts, topicData] = await Promise.all([
			topics.crossposts.get(tid),
			topics.getTopicData(tid),
		]);
		await topics.crossposts.syncCrosspostedTopicCids(crossposts, topicData);

		const scores = await db.sortedSetsScore([
			`cid:${targetCategory.cid}:tids:posts`,
			`cid:${targetCategory.cid}:tids:votes`,
			`cid:${targetCategory.cid}:tids:views`,
		], tid);
		assert(scores.every(score => score === null), 'a pinned topic should not be re-added to these sets');
	});

	it('should remove the topic from the destination sets when uncrossposted', async () => {
		const { tid } = await createTopic();
		await topics.crossposts.add(tid, targetCategory.cid, uid);
		await topics.crossposts.remove(tid, targetCategory.cid, uid);

		const scores = await db.sortedSetsScore([
			`cid:${targetCategory.cid}:tids`,
			`cid:${targetCategory.cid}:tids:create`,
			`cid:${targetCategory.cid}:tids:lastposttime`,
			`cid:${targetCategory.cid}:tids:pinned`,
		], tid);
		assert(scores.every(score => score === null), 'destination sets should not reference the topic');
	});
});
