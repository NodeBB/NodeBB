'use strict';

const assert = require('assert');
const nconf = require('nconf');
const util = require('util');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const install = require('../../src/install');
const user = require('../../src/user');
const categories = require('../../src/categories');
const posts = require('../../src/posts');
const topics = require('../../src/topics');
const api = require('../../src/api');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

const helpers = require('./helpers');
const wait = util.promisify(setTimeout);

describe('Notes', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	describe('Assertion', () => {
		describe('Public objects', () => {
			it('should pull a remote root-level object by its id and create a new topic', async () => {
				const { id } = helpers.mocks.note();
				const assertion = await activitypub.notes.assert(0, id, { skipChecks: true });
				assert(assertion);

				const { tid, count } = assertion;
				assert(tid);
				assert.strictEqual(count, 1);

				const exists = await topics.exists(tid);
				assert(exists);
			});

			it('should assert if the cc property is missing', async () => {
				const { id } = helpers.mocks.note({ cc: 'remove' });
				const assertion = await activitypub.notes.assert(0, id, { skipChecks: true });
				assert(assertion);

				const { tid, count } = assertion;
				assert(tid);
				assert.strictEqual(count, 1);

				const exists = await topics.exists(tid);
				assert(exists);
			});

			it('should assert if the object is of type Video', async () => {
				const { id } = helpers.mocks.note({
					type: 'Video',
				});
				const assertion = await activitypub.notes.assert(0, id, { skipChecks: true });
				assert(assertion);

				const { tid, count } = assertion;
				assert(tid);
				assert.strictEqual(count, 1);

				const exists = await topics.exists(tid);
				assert(exists);
			});

			describe('Category-specific behaviours', () => {
				it('should slot newly created topic in local category if addressed', async () => {
					const { cid } = await categories.create({ name: utils.generateUUID() });
					const { id } = helpers.mocks.note({
						cc: [`${nconf.get('url')}/category/${cid}`],
					});

					const assertion = await activitypub.notes.assert(0, id);
					assert(assertion);

					const { tid, count } = assertion;
					assert(tid);
					assert.strictEqual(count, 1);

					const topic = await topics.getTopicData(tid);
					assert.strictEqual(topic.cid, cid);
				});

				it('should add a remote category topic to a user\'s inbox if they are following the category', async () => {
					const { id: cid, actor } = helpers.mocks.group();
					await activitypub.actors.assertGroup([cid]);

					const uid = await user.create({ username: utils.generateUUID() });
					await api.categories.setWatchState({ uid }, { cid, state: categories.watchStates.tracking });

					const { id } = helpers.mocks.note({
						cc: [cid],
					});
					const { tid } = await activitypub.notes.assert(0, id, { cid });

					const inInbox = await db.isSortedSetMember(`uid:${uid}:inbox`, tid);
					assert(inInbox);
				});
			});

			describe('User-specific behaviours', () => {
				let remoteCid;
				let uid;

				before(async () => {
					// Remote
					const { id, actor } = helpers.mocks.group();
					remoteCid = id;
					await activitypub.actors.assertGroup([id]);

					// User
					uid = await user.create({ username: utils.generateUUID() });
					await topics.markAllRead(uid);
				});

				it('should not show up in my unread if it is in cid -1', async () => {
					const { id } = helpers.mocks.note();
					const assertion = await activitypub.notes.assert(0, id, { skipChecks: 1 });
					assert(assertion);

					const unread = await topics.getTotalUnread(uid);
					assert.strictEqual(unread, 0);
				});

				it('should show up in my recent/unread if I am tracking the remote category', async () => {
					await api.categories.setWatchState({ uid }, {
						cid: remoteCid,
						state: categories.watchStates.tracking,
						uid,
					});

					const { id } = helpers.mocks.note({
						cc: [remoteCid],
					});
					const assertion = await activitypub.notes.assert(0, id, { cid: remoteCid });
					assert(assertion);

					const unread = await topics.getTotalUnread(uid);
					assert.strictEqual(unread, 1);

					await topics.markAllRead(uid);
				});

				it('should show up in recent/unread and notify me if I am watching the remote category', async () => {
					await api.categories.setWatchState({ uid }, {
						cid: remoteCid,
						state: categories.watchStates.watching,
						uid,
					});

					const { id, note } = helpers.mocks.note({
						cc: [remoteCid],
					});
					const assertion = await activitypub.notes.assert(0, id, { cid: remoteCid });
					assert(assertion);

					const unread = await topics.getTotalUnread(uid);
					assert.strictEqual(unread, 1);
	
					// Notification inbox delivery is async so can't test directly
					// So we have to manually yield to the event loop to let it complete
					await new Promise(resolve => setImmediate(resolve));
					const exists = await db.exists(`notifications:new_topic:tid:${assertion.tid}:uid:${note.attributedTo}`);
					assert(exists);

					await topics.markAllRead(uid);
				});

				it('should not show up in recent/unread if I am ignoring the remote category', async () => {
					await api.categories.setWatchState({ uid }, {
						cid: remoteCid,
						state: categories.watchStates.ignoring,
						uid,
					});

					const { id, note } = helpers.mocks.note({
						cc: [remoteCid],
					});
					const assertion = await activitypub.notes.assert(0, id, { cid: remoteCid });
					assert(assertion);

					const unread = await topics.getTotalUnread(uid);
					assert.strictEqual(unread, 0);
				});
			});
		});

		describe('Private objects', () => {
			let recipientUid;

			before(async () => {
				recipientUid = await user.create({ username: utils.generateUUID().slice(0, 8) });
			});

			it('should NOT create a new topic or post when asserting a private note', async () => {
				const { id, note } = helpers.mocks.note({
					to: [`${nconf.get('url')}/uid/${recipientUid}`],
					cc: [],
				});
				const { activity } = helpers.mocks.create(note);
				const { roomId } = await activitypub.inbox.create({ body: activity });
				assert(roomId);
				assert(utils.isNumber(roomId));

				const exists = await posts.exists(id);
				assert(!exists);
			});

			it('should still assert if the cc property is missing', async () => {
				const { id, note } = helpers.mocks.note({
					to: [`${nconf.get('url')}/uid/${recipientUid}`],
					cc: 'remove',
				});
				const { activity } = helpers.mocks.create(note);
				const { roomId } = await activitypub.inbox.create({ body: activity });
				assert(roomId);
				assert(utils.isNumber(roomId));
			});
		});
	});

	describe('Creation', () => {
		let uid;

		before(async () => {
			uid = await user.create({ username: utils.generateUUID() });
		});

		describe('Local categories', () => {
			let cid;

			before(async () => {
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				activitypub._sent.clear();
			});

			afterEach(() => {
				activitypub._sent.clear();
			});

			describe('new topics', () => {
				let activity;

				before(async () => {
					const { tid } = await api.topics.create({ uid }, {
						cid,
						title: utils.generateUUID(),
						content: 'Guaranteed to be more than 500 characters.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. In vel convallis felis. Phasellus porta erat a elit dignissim efficitur. Sed at sollicitudin erat, finibus sodales ante. Nunc ullamcorper, urna a pulvinar tempor, nunc risus venenatis nunc, id aliquam purus dui ut ante. Nulla sit amet risus sem. Praesent sit amet justo finibus, laoreet odio nec, varius diam. Nullam congue rhoncus lorem, eu accumsan leo aliquam sit amet. Suspendisse fringilla nec libero a tincidunt. Phasellus sapien justo, lacinia ac enim sit amet, pellentesque fermentum neque. Proin sit amet felis vitae libero aliquam pharetra at id nisi. Donec vitae mauris est. Sed hendrerit nisi et nibh auctor hendrerit. Praesent feugiat tortor a dignissim sagittis. Cras sit amet ante justo. Cras consectetur magna vitae volutpat placerat. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae',
					});
					await wait(50);

					assert(tid);
					assert.strictEqual(activitypub._sent.size, 1);
					const key = Array.from(activitypub._sent.keys())[0];
					activity = activitypub._sent.get(key);
				});

				it('should federate out a Create activity', () => {
					assert(activity && activity.payload && activity.payload.to);
					assert.strictEqual(activity.payload.type, 'Create');
				});

				it('should have the local category addressed', () => {
					const addressees = new Set([
						...(activity.payload.to || []),
						...(activity.payload.cc || []),
						...(activity.payload.bcc || []),
						...(activity.payload.object.to || []),
						...(activity.payload.object.cc || []),
						...(activity.payload.object.bcc || []),
					]);

					assert(addressees.has(`${nconf.get('url')}/category/${cid}`));
				});

				it('should federate out an activity with object of type "Article"', () => {
					assert(activity.payload.object && activity.payload.object.type);
					assert.strictEqual(activity.payload.object.type, 'Article');
				});
			});

			describe('new reply', () => {
				let activity;

				before(async () => {
					const { tid } = await api.topics.create({ uid }, {
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});
					activitypub._sent.clear();

					const { pid } = await api.topics.reply({ uid }, {
						tid,
						content: utils.generateUUID(),
					});
					await wait(50);

					const key = Array.from(activitypub._sent.keys())[0];
					activity = activitypub._sent.get(key);
				});

				it('should federate out an activity with object of type "Article"', () => {
					assert(activity.payload && activity.payload.object && activity.payload.object.type);
					assert.strictEqual(activity.payload.object.type, 'Article');
				});
			});
		});

		describe('Remote Categories', () => {
			let cid;

			before(async () => {
				({ id: cid } = helpers.mocks.group());
				await activitypub.actors.assert([cid]);
			});

			afterEach(() => {
				activitypub._sent.clear();
			});

			describe('new topics', () => {
				it('should federate out a Create activity with the remote community addressed', async () => {
					const { tid } = await api.topics.create({ uid }, {
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});
					await wait(50);

					assert(tid);
					assert.strictEqual(activitypub._sent.size, 1);

					const key = Array.from(activitypub._sent.keys())[0];
					const activity = activitypub._sent.get(key);
					assert(activity && activity.payload && activity.payload.to);
					assert.strictEqual(activity.payload.type, 'Create');

					const addressees = new Set([
						...(activity.payload.to || []),
						...(activity.payload.cc || []),
						...(activity.payload.bcc || []),
						...(activity.payload.object.to || []),
						...(activity.payload.object.cc || []),
						...(activity.payload.object.bcc || []),
					]);

					assert(addressees.has(cid));
				});
			});

			describe('replies', () => {
				it('should federate out a Create activity with the remote community addressed', async () => {
					const { tid } = await api.topics.create({ uid }, {
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});

					activitypub._sent.clear();

					const postData = await api.topics.reply({ uid }, {
						tid,
						content: utils.generateUUID(),
					});

					assert(postData);
					assert.strictEqual(activitypub._sent.size, 1);

					const key = Array.from(activitypub._sent.keys())[0];
					const activity = activitypub._sent.get(key);
					assert(activity && activity.payload && activity.payload.to);
					assert.strictEqual(activity.payload.type, 'Create');

					const addressees = new Set([
						...(activity.payload.to || []),
						...(activity.payload.cc || []),
						...(activity.payload.bcc || []),
						...(activity.payload.object.to || []),
						...(activity.payload.object.cc || []),
						...(activity.payload.object.bcc || []),
					]);

					assert(addressees.has(cid));
				});
			});
		});
	});

	describe('Deletion', () => {
		let cid;
		let uid;
		let topicData;

		before(async () => {
			({ cid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
		});

		beforeEach(async () => {
			uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			({ topicData } = await topics.post({
				cid,
				uid,
				title: utils.generateUUID(),
				content: utils.generateUUID(),
			}));
		});

		it('should clean up recipient sets for the post', async () => {
			const { pid } = await topics.reply({
				pid: `https://example.org/${utils.generateUUID().slice(0, 8)}`,
				tid: topicData.tid,
				uid,
				content: utils.generateUUID(),
			});
			await db.setAdd(`post:${pid}:recipients`, [uid]);
			await activitypub.notes.delete([pid]);

			const inboxed = await db.isSetMember(`post:${pid}:recipients`, uid);
			assert(!inboxed);
		});
	});
});
