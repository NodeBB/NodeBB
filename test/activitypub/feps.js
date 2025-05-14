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
const posts = require('../../src/posts');
const api = require('../../src/api');

const helpers = require('./helpers');

describe('FEPs', () => {
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

			describe('local actions (create, reply, vote)', () => {
				let topicData;

				before(async () => {
					topicData = await api.topics.create({ uid }, {
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});
				});

				afterEach(() => {
					activitypub._sent.clear();
				});

				it('should have federated out both Announce(Create(Article)) and Announce(Article)', () => {
					const activities = Array.from(activitypub._sent);

					const test1 = activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Create' &&
							activity.object.object && activity.object.object.type === 'Article';
					});

					const test2 = activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Article';
					});

					assert(test1 && test2);
				});

				it('should federate out Announce(Create(Note)) on local reply', async () => {
					await api.topics.reply({ uid }, {
						tid: topicData.tid,
						content: utils.generateUUID(),
					});

					const activities = Array.from(activitypub._sent);

					assert(activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Create' &&
							activity.object.object && activity.object.object.type === 'Note';
					}));
				});

				it('should NOT federate out Announce(Note) on local reply', async () => {
					await api.topics.reply({ uid }, {
						tid: topicData.tid,
						content: utils.generateUUID(),
					});

					const activities = Array.from(activitypub._sent);

					assert(activities.every((activity) => {
						[, activity] = activity;
						if (activity.type === 'Announce' && activity.object && activity.object.type === 'Note') {
							return false;
						}

						return true;
					}));
				});

				it('should federate out Announce(Like) on local vote', async () => {
					activitypub._sent.clear();
					await api.posts.upvote({ uid: adminUid }, { pid: topicData.mainPid, room_id: `topic_${topicData.tid}` });
					const activities = Array.from(activitypub._sent);

					assert(activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Like';
					}));
				});
			});

			describe('remote actions (create, reply, vote)', () => {
				let activity;
				let pid;
				let topicData;

				before(async () => {
					topicData = await api.topics.create({ uid }, {
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});
				});

				afterEach(() => {
					activitypub._sent.clear();
				});

				it('should have slotted the note into the test category', async () => {
					const { id, note } = await helpers.mocks.note({
						cc: [`${nconf.get('url')}/category/${cid}`],
					});
					pid = id;
					({ activity } = await helpers.mocks.create(note));
					await activitypub.inbox.create({ body: activity });

					const noteCid = await posts.getCidByPid(pid);
					assert.strictEqual(noteCid, cid);
				});

				it('should federate out an Announce(Create(Note)) and Announce(Note) on new topic', async () => {
					const { id, note } = await helpers.mocks.note({
						cc: [`${nconf.get('url')}/category/${cid}`],
					});
					pid = id;
					({ activity } = await helpers.mocks.create(note));
					await activitypub.inbox.create({ body: activity });

					const activities = Array.from(activitypub._sent);

					const test1 = activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Create' &&
							activity.object.object && activity.object.object.type === 'Note';
					});

					const test2 = activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Note';
					});

					assert(test1 && test2);
				});

				it('should federate out an Announce(Create(Note)) on reply', async () => {
					const { id, note } = await helpers.mocks.note({
						cc: [`${nconf.get('url')}/category/${cid}`],
						inReplyTo: `${nconf.get('url')}/post/${topicData.mainPid}`,
					});
					pid = id;
					({ activity } = await helpers.mocks.create(note));
					await activitypub.inbox.create({ body: activity });

					const activities = Array.from(activitypub._sent);

					assert(activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Create' &&
							activity.object.object && activity.object.object.type === 'Note';
					}));
				});

				it('should federate out an Announce(Like) on vote', async () => {
					const { activity } = await helpers.mocks.like({
						object: {
							id: `${nconf.get('url')}/post/${topicData.mainPid}`,
						},
					});
					await activitypub.inbox.like({ body: activity });

					const activities = Array.from(activitypub._sent);
					assert(activities.some((activity) => {
						[, activity] = activity;
						return activity.type === 'Announce' &&
							activity.object && activity.object.type === 'Like';
					}));
				});
			});

			describe('extended actions not explicitly specified in 1b12', () => {
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

					assert.strictEqual(activitypub._sent.size, 2);

					const key = Array.from(activitypub._sent.keys())[0];
					const activity = activitypub._sent.get(key);

					assert(activity && activity.object && typeof activity.object === 'object');
					assert.strictEqual(activity.object.id, `${nconf.get('url')}/post/${postData.pid}`);
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
					assert.strictEqual(activity.object.id, `${nconf.get('url')}/post/${reply1Pid}`);
				});

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

					// Create new reply and move it to topic 2
					const { pid } = await topics.reply({ uid, tid: topic1.tid, content: utils.generateUUID() });
					await api.posts.move({ uid: adminUid }, { pid, tid: topic2.tid });

					assert.strictEqual(activitypub._sent.size, 1);
					const activities = Array.from(activitypub._sent.keys()).map(key => activitypub._sent.get(key));

					const activity = activities.pop();
					assert.strictEqual(activity.type, 'Announce');
					assert(activity.object && activity.object.type);
					assert.strictEqual(activity.object.type, 'Create');
					assert(activity.object.object && activity.object.object.type);
					assert.strictEqual(activity.object.object.type, 'Note');
				});
			});
		});
	});
});
