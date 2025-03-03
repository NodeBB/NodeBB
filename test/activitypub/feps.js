'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');
const meta = require('../../src/meta');
const install = require('../../src/install');
const user = require('../../src/user');
const groups = require('../../src/groups');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const api = require('../../src/api');

const helpers = require('./helpers');

describe('FEPs', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	describe.only('1b12', () => {
		describe('announceObject()', () => {
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

				const { id: followerId, actor } = helpers.mocks.actor();
				activitypub._cache.set(`0;${followerId}`, actor);
				user.setCategoryWatchState(followerId, [cid], categories.watchStates.tracking);

				activitypub._sent.clear();
			});

			afterEach(() => {
				activitypub._sent.clear();
			});

			it('should be called when a topic is moved from uncategorized to another category', async () => {
				const { topicData } = await topics.post({
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

				assert.strictEqual(activitypub._sent.size, 1);
			});

			it('should be called for a newly forked topic', async () => {
				const { topicData } = await topics.post({
					uid,
					cid: -1,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});
				const { tid } = topicData;
				const [{ pid: reply1Pid }, { pid: reply2Pid }] = await Promise.all([
					topics.reply({ uid, tid, content: utils.generateUUID() }),
					topics.reply({ uid, tid, content: utils.generateUUID() }),
				]);
				const forked = await topics.createTopicFromPosts(
					adminUid, utils.generateUUID(), [reply1Pid, reply2Pid], tid, cid
				);

				assert.strictEqual(activitypub._sent.size, 1);

				const key = Array.from(activitypub._sent.keys())[0];
				const activity = activitypub._sent.get(key);

				assert(activity);
				assert.strictEqual(activity.object, `${nconf.get('url')}/post/${reply1Pid}`);
			});
		});
	});
});
