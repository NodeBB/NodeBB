import assert from 'assert';
import { strict as assertStrict } from 'assert';
import nconf from 'nconf';

import '../mocks/databasemock.mjs';
import activitypub from '../../src/activitypub/index.js';
import utils from '../../src/utils.js';
import meta from '../../src/meta/index.js';
import install from '../../src/install.js';
import user from '../../src/user/index.js';
import groups from '../../src/groups/index.js';
import categories from '../../src/categories/index.js';
import topics from '../../src/topics/index.js';
import api from '../../src/api/index.js';
import helpers from './helpers.mjs';

describe('ActivityPub/FEPs', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	describe('1b12', () => {
		describe('announce()', () => {
			let cid;
			let uid;
			let adminUid;

			before(async () => {
				const name = utils.generateUUID();
				const description = utils.generateUUID();
				({ cid } = await categories.create({ name, description }));

				adminUid = await user.create({ username: utils.generateUUID() });
				await groups.join('administrators', adminUid);
				uid = await user.create({ username: utils.generateUUID() });

				const { id: followerId, actor } = helpers.mocks.person();
				user.setCategoryWatchState(followerId, [cid], categories.watchStates.tracking);

				activitypub._sent.clear();
			});

			afterEach(() => {
				activitypub._sent.clear();
			});

			it('should be called when a topic is moved from uncategorized to another category', async () => {
				const { topicData, postData } = await topics.post({
					uid,
					cid: -1,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});

				assert(topicData);

				await api.topics.move({ uid: adminUid }, {
					tid: topicData.tid,
					cid,
				});

				assertStrict.strictEqual(activitypub._sent.size, 2);

				const key = Array.from(activitypub._sent.keys())[0];
				const activity = activitypub._sent.get(key);

				assert(activity && activity.object && typeof activity.object === 'object');
				assertStrict.strictEqual(activity.object.id, `${nconf.get('url')}/post/${postData.pid}`);
			});

			it('should be called for a newly forked topic', async () => {
				const { topicData } = await topics.post({
					uid,
					cid: -1,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});
				const { tid } = topicData;
				const { pid: reply1Pid } = await topics.reply({ uid, tid, content: utils.generateUUID() });
				const { pid: reply2Pid } = await topics.reply({ uid, tid, content: utils.generateUUID() });
				await topics.createTopicFromPosts(
					adminUid, utils.generateUUID(), [reply1Pid, reply2Pid], tid, cid
				);

				assert.strictEqual(activitypub._sent.size, 2, activitypub._sent.keys());

				const key = Array.from(activitypub._sent.keys())[0];
				const activity = activitypub._sent.get(key);

				assert(activity && activity.object && typeof activity.object === 'object');
				assertStrict.strictEqual(activity.object.id, `${nconf.get('url')}/post/${reply1Pid}`);
			});

			/**
			 * !!!flaky test!!!
			 */
			it('should be called when a post is moved to another topic', async () => {
				const [{ topicData: topic1 }, { topicData: topic2 }] = await Promise.all([
					topics.post({
						uid,
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					}),
					topics.post({
						uid,
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					}),
				]);

				assert(topic1 && topic2);
				assert.notStrictEqual(topic1.tid, topic2.tid);

				// Create new reply and move it to topic 2
				const { pid } = await topics.reply({ uid, tid: topic1.tid, content: utils.generateUUID() });
				await api.posts.move({ uid: adminUid }, { pid, tid: topic2.tid });

				assertStrict.strictEqual(activitypub._sent.size, 1);
				const activities = Array.from(activitypub._sent.keys()).map(key => activitypub._sent.get(key));

				const activity = activities.pop();
				assertStrict.strictEqual(activity.type, 'Announce');
				assert(activity.object && activity.object.type);
				assertStrict.strictEqual(activity.object.type, 'Create');
				assert(activity.object.object && activity.object.object.type);
				assertStrict.strictEqual(activity.object.object.type, 'Note');
			});
		});
	});
});