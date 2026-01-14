'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');

const meta = require('../../src/meta');
const install = require('../../src/install');
const user = require('../../src/user');
const groups = require('../../src/groups');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const privileges = require('../../src/privileges');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

describe('Crossposting (& related logic)', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

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

		it('should not allow a spider (uid -1) to crosspost', async () => {
			await assert.rejects(
				topics.crossposts.add(tid, cid2, -1),
				{ message: '[[error:invalid-uid]]' }
			);
		});

		it('should successfully crosspost to another cid', async () => {
			const crossposts = await topics.crossposts.add(tid, cid2, uid);

			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 1);

			const actual = crossposts[0];
			assert.deepStrictEqual({
				uid: actual.uid,
				tid: actual.tid,
				cid: actual.cid,
			}, {
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

		it('should not let another user uncrosspost', async () => {
			const uid2 = await user.create({ username: utils.generateUUID().slice(0, 8) });
			assert.rejects(
				topics.crossposts.remove(tid, cid2, uid2),
				'[[error:invalid-data]]',
			);
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

	describe('uncrosspost (as administrator)', () => {
		let tid;
		let cid1;
		let cid2;
		let uid;
		let privUid;

		before(async () => {
			({ cid: cid1 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			const crosspostCategory = await categories.create({ name: utils.generateUUID().slice(0, 8) });
			cid2 = crosspostCategory.cid;
			uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			privUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			await groups.join('administrators', privUid);

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
			const crossposts = await topics.crossposts.remove(tid, cid2, privUid);

			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 0);
		});
	});

	describe('uncrosspost (as global moderator)', () => {
		let tid;
		let cid1;
		let cid2;
		let uid;
		let privUid;

		before(async () => {
			({ cid: cid1 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			const crosspostCategory = await categories.create({ name: utils.generateUUID().slice(0, 8) });
			cid2 = crosspostCategory.cid;
			uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			privUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			await groups.join('Global Moderators', privUid);

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
			const crossposts = await topics.crossposts.remove(tid, cid2, privUid);

			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 0);
		});
	});

	describe('uncrosspost (as category moderator)', () => {
		let tid;
		let cid1;
		let cid2;
		let uid;
		let privUid;

		before(async () => {
			({ cid: cid1 } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			const crosspostCategory = await categories.create({ name: utils.generateUUID().slice(0, 8) });
			cid2 = crosspostCategory.cid;
			uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			privUid = await user.create({ username: utils.generateUUID().slice(0, 8) });

			const { topicData } = await topics.post({
				uid,
				cid: cid1,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			});
			tid = topicData.tid;

			await topics.crossposts.add(tid, cid2, uid);
		});

		it('should fail to uncrosspost if not mod of passed-in category', async () => {
			await privileges.categories.give(['moderate'], cid1, [privUid]);
			assert.rejects(
				topics.crossposts.remove(tid, cid2, privUid),
				'[[error:invalid-data]]',
			);
		});

		it('should successfully uncrosspost from a cid if proper mod', async () => {
			await privileges.categories.give(['moderate'], cid2, [privUid]);
			const crossposts = await topics.crossposts.remove(tid, cid2, privUid);

			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 0);
		});
	});

	describe('Deletion', () => {
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
			await topics.delete(tid, uid);
		});

		it('should maintain crossposts when topic is deleted', async () => {
			const crossposts = await topics.crossposts.get(tid);
			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 1);
		});
	});

	describe('Purging', () => {
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
			await topics.purge(tid, uid);
		});

		it('should remove crossposts when topic is purged', async () => {
			const crossposts = await topics.crossposts.get(tid);
			assert(Array.isArray(crossposts));
			assert.strictEqual(crossposts.length, 0);
		});
	});

	describe('category sync; integration with', () => {
		let cid;
		let remoteCid;
		let pid;
		let post;

		const helpers = require('../activitypub/helpers');

		before(async () => {
			({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			({ id: remoteCid } = helpers.mocks.group());
			({ id: pid, note: post } = helpers.mocks.note({
				audience: [remoteCid],
			}));

			// Mock a group follow/accept
			const timestamp = Date.now();
			await Promise.all([
				db.sortedSetAdd(`cid:${cid}:following`, timestamp, remoteCid),
				db.sortedSetAdd(`followersRemote:${remoteCid}`, timestamp, `cid|${cid}`),
			]);
		});

		it('should automatically cross-post the topic when the remote category announces', async () => {
			const { activity: body } = helpers.mocks.announce({
				actor: remoteCid,
				object: post,
			});

			await activitypub.inbox.announce({ body });

			const tid = await posts.getPostField(pid, 'tid');
			const crossposts = await topics.crossposts.get(tid);

			assert.strictEqual(crossposts.length, 1);

			const actual = crossposts[0];
			assert.deepStrictEqual({
				uid: actual.uid,
				tid: actual.tid,
				cid: actual.cid,
			}, {
				uid: 0,
				tid,
				cid: cid,
			});
		});
	});

	describe('auto-categorization; integration with', () => {
		let cid;
		let remoteCid;
		let pid;
		let post;

		const helpers = require('../activitypub/helpers');

		before(async () => {
			const preferredUsername = utils.generateUUID().slice(0, 8);
			({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			({ id: remoteCid } = helpers.mocks.group({
				preferredUsername,
			}));
			({ id: pid, note: post } = helpers.mocks.note({
				audience: [remoteCid],
				tag: [
					{
						type: 'Hashtag',
						name: `#${preferredUsername}`,
					},
				],
			}));

			await activitypub.rules.add('hashtag', preferredUsername, cid);
		});

		it('note assertion should automatically cross-post', async () => {
			await activitypub.notes.assert(0, pid, { skipChecks: true });

			const tid = await posts.getPostField(pid, 'tid');
			const crossposts = await topics.crossposts.get(tid);
			assert.strictEqual(crossposts.length, 1);

			const actual = crossposts[0];
			assert.deepStrictEqual({
				uid: actual.uid,
				tid: actual.tid,
				cid: actual.cid,
			}, {
				uid: 0,
				tid,
				cid: cid,
			});
		});
	});

	describe('ActivityPub effects (or lack thereof)', () => {
		describe('local canonical category', () => {
			let tid;
			let cid1;
			let cid2;
			let uid;
			let pid;

			const helpers = require('../activitypub/helpers');

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
				pid = topicData.mainPid,

				// Add some remote followers
				await Promise.all([cid1, cid2].map(async (cid) => {
					const {activity} = helpers.mocks.follow({
						object: {
							id: `${nconf.get('url')}/category/${cid}`,
						},
					});
					await activitypub.inbox.follow({
						body: activity,
					});
				}));

				activitypub._sent.clear();
			});

			afterEach(() => {
				activitypub._sent.clear();
			});

			it('should not federate out any events on crosspost', async () => {
				await topics.crossposts.add(tid, cid2, uid);
				assert.strictEqual(activitypub._sent.size, 0);
			});

			it('should not federate out anything on uncrosspost', async () => {
				await topics.crossposts.remove(tid, cid2, uid);
				assert.strictEqual(activitypub._sent.size, 0);
			});

			it('should only federate an Announce on a remote reply from the canonical cid', async () => {
				const { note: object } = helpers.mocks.note({
					audience: `${nconf.get('url')}/category/${cid1}`,
					inReplyTo: `${nconf.get('url')}/post/${pid}`,
				});
				const { activity } = helpers.mocks.create(object);
				await activitypub.inbox.create({
					body: activity,
				});

				assert.strictEqual(activitypub._sent.size, 1);

				const actual = Array.from(activitypub._sent).pop()[1];
				assert.deepStrictEqual({
					type: actual.payload.type,
					actor: actual.payload.actor,
					object: actual.payload.object,
				}, {
					type: 'Announce',
					actor: `${nconf.get('url')}/category/${cid1}`,
					object: activity,
				});
			});

			it('should only federate an Announce on a remote like from the canonical cid', async () => {
				const { activity: body } = helpers.mocks.like({
					object: {
						id: `${nconf.get('url')}/post/${pid}`,
					},
				});
				await activitypub.inbox.like({ body });

				assert.strictEqual(activitypub._sent.size, 1);

				const actual = Array.from(activitypub._sent).pop()[1];
				assert.deepStrictEqual({
					type: actual.payload.type,
					actor: actual.payload.actor,
					object: actual.payload.object,
				}, {
					type: 'Announce',
					actor: `${nconf.get('url')}/category/${cid1}`,
					object: body,
				});
			});
		});

		describe('remote canonical category', () => {
			let tid;
			let cid;
			let remoteCid;
			let uid;
			let pid;

			const helpers = require('../activitypub/helpers');

			before(async () => {
				({ id: remoteCid } = helpers.mocks.group());
				await activitypub.actors.assertGroup(remoteCid);
				({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
				uid = await user.create({ username: utils.generateUUID().slice(0, 8) });

				({ id: pid } = helpers.mocks.note());
				await activitypub.notes.assert(0, pid, { skipChecks: 1, cid: remoteCid });

				tid = await posts.getPostField(pid, 'tid');

				await topics.crossposts.add(tid, cid, uid);
			});

			it('should properly address the remote category when federating out a local reply', async () => {
				const postData = await topics.reply({
					uid,
					cid,
					tid,
					content: utils.generateUUID(),
				});
				const mocked = await activitypub.mocks.notes.public(postData);
				assert(mocked.to.includes(remoteCid));
			});
		});
	});
});