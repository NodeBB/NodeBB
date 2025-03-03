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

	describe('1b12', () => {
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
		});
	});
});
