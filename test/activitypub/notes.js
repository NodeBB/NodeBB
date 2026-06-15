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

	describe('Blocklist severity 3 (filter)', () => {
		/**
		 * Clear the post queue between tests.
		 */
		async function clearQueue() {
			const queuedIds = await db.getSortedSetMembers('post:queue');
			await Promise.all(queuedIds.map(async (id) => {
				await db.delete(`post:queue:${id}`);
			}));
			await db.delete('post:queue');
		}

		/**
		 * Mock instances.isAllowed to return a specific severity for a domain.
		 */
		function mockBlockedDomain(domain, severity) {
			activitypub.instances.isAllowed = async (hostname) => {
				if (hostname === domain) {
					return {
						allowed: severity > 2,
						severity,
						listUrl: 'https://example.org/blocklist.csv',
					};
				}
				return activitypub.instances._originalIsAllowed(hostname);
			};
		}

		before(async () => {
			activitypub.instances._originalIsAllowed = activitypub.instances.isAllowed;
			meta.config.postQueue = 1;
		});

		after(async () => {
			delete meta.config.postQueue;
			if (activitypub.instances._originalIsAllowed) {
				activitypub.instances.isAllowed = activitypub.instances._originalIsAllowed;
			}
		});

		beforeEach(async () => {
			await clearQueue();
		});

		describe('!hasTid — new topic', () => {
			beforeEach(function () {
				mockBlockedDomain('blocked.example.org', 3);
				this._baseUrl = helpers.mocks._baseUrl;
				helpers.mocks._baseUrl = 'https://blocked.example.org';
			});

			afterEach(function () {
				helpers.mocks._baseUrl = this._baseUrl;
			});

			it('should queue the main post instead of creating it', async () => {
				const { id: noteId } = helpers.mocks.note();
				const assertion = await activitypub.notes.assert(0, noteId, {
					skipChecks: true,
				});

				assert(assertion);
				assert.strictEqual(assertion.tid, null);
				assert.strictEqual(assertion.queued, 1);
				assert.strictEqual(assertion.count, undefined);

				const queueCount = await db.sortedSetCard('post:queue');
				assert.strictEqual(queueCount, 1);
			});

			it('should queue parent and drop replies when hasTid is false', async () => {
				const { id: parentId } = helpers.mocks.note();
				const { id: replyId } = helpers.mocks.note({
					inReplyTo: parentId,
				});

				// Assert the parent with severity 3 — should queue and return tid: null
				const parentAssertion = await activitypub.notes.assert(0, parentId, {
					skipChecks: true,
				});

				assert(parentAssertion);
				assert.strictEqual(parentAssertion.tid, null);
				assert.strictEqual(parentAssertion.queued, 1);

				// Assert the reply with severity 3 — parent has no tid, so hasTid is false
				const replyAssertion = await activitypub.notes.assert(0, replyId, {
					skipChecks: true,
				});

				assert(replyAssertion);
				assert.strictEqual(replyAssertion.tid, null);
				assert.strictEqual(replyAssertion.queued, 1);

				// Verify neither post was created as a real topic/reply
				assert.strictEqual(await posts.exists(parentId), false);
				assert.strictEqual(await posts.exists(replyId), false);

				const queueCount = await db.sortedSetCard('post:queue');
				assert.strictEqual(queueCount, 1);
			});
		});

		describe('hasTid — existing topic', () => {
			let tid;
			let mainPid;
			let cid;

			before(async () => {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				const { topicData, postData } = await topics.post({
					cid,
					uid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});
				tid = topicData.tid;
				mainPid = postData.pid;
			});

			beforeEach(function () {
				mockBlockedDomain('blocked.example.org', 3);
				this._baseUrl = helpers.mocks._baseUrl;
				helpers.mocks._baseUrl = 'https://blocked.example.org';
			});

			afterEach(function () {
				helpers.mocks._baseUrl = this._baseUrl;
			});

			it('should queue replies when severity is 3', async () => {
				const { id: replyId } = helpers.mocks.note({
					inReplyTo: mainPid,
				});
				const assertion = await activitypub.notes.assert(0, replyId, {
					skipChecks: true,
				});

				assert(assertion);
				assert.strictEqual(assertion.tid, tid);
				assert.strictEqual(assertion.queued, 1);

				const queueCount = await db.sortedSetCard('post:queue');
				assert.strictEqual(queueCount, 1);
			});

			it('should queue multiple replies', async () => {
				const { id: id1 } = helpers.mocks.note({
					inReplyTo: mainPid,
				});
				const { id: id2 } = helpers.mocks.note({
					inReplyTo: mainPid,
				});

				const assertion1 = await activitypub.notes.assert(0, id1, {
					skipChecks: true,
				});
				const assertion2 = await activitypub.notes.assert(0, id2, {
					skipChecks: true,
				});

				assert(assertion1);
				assert(assertion2);
				assert.strictEqual(assertion1.tid, tid);
				assert.strictEqual(assertion1.queued, 1);
				assert.strictEqual(assertion2.tid, tid);
				assert.strictEqual(assertion2.queued, 1);

				const queueCount = await db.sortedSetCard('post:queue');
				assert.strictEqual(queueCount, 2);
			});
		});

		describe('null case', () => {
			beforeEach(function () {
				this._baseUrl = helpers.mocks._baseUrl;
				helpers.mocks._baseUrl = 'https://allowed.example.org';
			});

			afterEach(function () {
				helpers.mocks._baseUrl = this._baseUrl;
			});

			it('should NOT queue posts when domain is not blocked', async () => {
				const { id: noteId } = helpers.mocks.note();
				const assertion = await activitypub.notes.assert(0, noteId, {
					skipChecks: true,
				});

				assert(assertion);
				assert(assertion.tid);
				assert.strictEqual(assertion.queued, 0);

				const queueCount = await db.sortedSetCard('post:queue');
				assert.strictEqual(queueCount, 0);
			});
		});

		describe('Severity 1 and 2', () => {
			beforeEach(function () {
				this._baseUrl = helpers.mocks._baseUrl;
				helpers.mocks._baseUrl = 'https://blocked.example.org';
			});

			afterEach(function () {
				helpers.mocks._baseUrl = this._baseUrl;
			});

			it('should NOT queue posts with severity 1 (suspend)', async () => {
				mockBlockedDomain('blocked.example.org', 1);
				const { id: noteId } = helpers.mocks.note();
				const assertion = await activitypub.notes.assert(0, noteId, {
					skipChecks: true,
				});

				assert(!assertion);

				const queueCount = await db.sortedSetCard('post:queue');
				assert.strictEqual(queueCount, 0);
			});

			it('should NOT queue posts with severity 2 (silence)', async () => {
				mockBlockedDomain('blocked.example.org', 2);
				const { id: noteId } = helpers.mocks.note();
				const assertion = await activitypub.notes.assert(0, noteId, {
					skipChecks: true,
				});

				assert(!assertion);

				const queueCount = await db.sortedSetCard('post:queue');
				assert.strictEqual(queueCount, 0);
			});
		});
	});

	describe('getParentChain', () => {
		it('should retrieve a two-note chain via inReplyTo', async () => {
			const { id: parentId } = helpers.mocks.note();
			const { id: childId } = helpers.mocks.note({ inReplyTo: parentId });

			const chain = await activitypub.notes.getParentChain(0, childId);

			assert(chain instanceof Set);
			assert.strictEqual(chain.size, 2);

			const pids = Array.from(chain).map((n) => n.pid);
			assert(pids.includes(parentId));
			assert(pids.includes(childId));
		});

		it('should stop at configured depth', async () => {
			meta.config.activitypubParentTraversalDepth = 30;

			const noteIds = [];
			let previousId = null;
			for (let i = 0; i < 55; i += 1) {
				const noteData = previousId ? { inReplyTo: previousId } : {};
				const { id } = helpers.mocks.note(noteData);
				noteIds.push(id);
				previousId = id;
			}

			const chain = await activitypub.notes.getParentChain(0, noteIds[noteIds.length - 1]);

			assert(chain instanceof Set);
			assert(chain.size <= 30);

			delete meta.config.activitypubParentTraversalDepth;
		});

		it('should use default depth of 50 when not configured', async () => {
			delete meta.config.activitypubParentTraversalDepth;

			const noteIds = [];
			let previousId = null;
			for (let i = 0; i < 55; i += 1) {
				const noteData = previousId ? { inReplyTo: previousId } : {};
				const { id } = helpers.mocks.note(noteData);
				noteIds.push(id);
				previousId = id;
			}

			const chain = await activitypub.notes.getParentChain(0, noteIds[noteIds.length - 1]);

			assert(chain instanceof Set);
			assert(chain.size <= 50);
		});
	});

	describe('auto-categorization with queue rule', () => {
		let remoteCid;
		let targetCid;
		let rid;
		const tagName = utils.generateUUID().slice(0, 8);

		before(async () => {
			// Create a remote group actor
			({ id: remoteCid } = helpers.mocks.group());
			// Create a local target category
			({ cid: targetCid } = await categories.create({ name: utils.generateUUID().slice(0, 8) }));
			// Add a hashtag-type auto-categorization rule with filter (queue) enabled
			rid = await activitypub.rules.upsert('hashtag', tagName, targetCid, true);
			meta.config.postQueue = 1;
		});

		after(async () => {
			delete meta.config.postQueue;
			if (rid) {
				await activitypub.rules.delete(rid);
			}
		});

		beforeEach(async () => {
			// Clear the queue
			const queuedIds = await db.getSortedSetMembers('post:queue');
			await Promise.all(queuedIds.map(async (id) => {
				await db.delete(`post:queue:${id}`);
			}));
			await db.delete('post:queue');
		});

		it('should queue as crosspost when auto-categorization rule matches with filter=true', async () => {
			const { id: noteId } = helpers.mocks.note({
				audience: [remoteCid],
				tag: [
					{ type: 'Hashtag', name: `#${tagName}` },
				],
			});
			const assertion = await activitypub.notes.assert(0, noteId, {
				skipChecks: true,
			});

			assert(assertion);
			assert.strictEqual(assertion.queued, 0); // topic in remote category parsed normally
			assert(assertion.tid);

			// Verify queue entry has crosspostCid
			const queueIds = await db.getSortedSetMembers('post:queue');
			assert.strictEqual(queueIds.length, 1);

			const queueData = await db.getObject(`post:queue:${queueIds[0]}`);
			assert.strictEqual(queueData.type, 'crosspost');
			const parsedData = typeof queueData.data === 'string' ? JSON.parse(queueData.data) : queueData.data;
			assert.strictEqual(parseInt(parsedData.crosspostCid, 10), targetCid);
			assert.strictEqual(parsedData.tid, assertion.tid);
		});
	});
});
