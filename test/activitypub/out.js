'use strict';

const assert = require('assert');
const nconf = require('nconf');
const util = require('util');

const db = require('../mocks/databasemock');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const meta = require('../../src/meta');
const install = require('../../src/install');
const messaging = require('../../src/messaging');
const utils = require('../../src/utils');
const activitypub = require('../../src/activitypub');

const helpers = require('./helpers');
const wait = util.promisify(setTimeout);

describe('Outbound activities module', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
		activitypub._sent.clear();

		// Prevent real outbound requests (serve objects from the AP cache)
		helpers.mocks.mockRequests();
	});

	after(() => {
		helpers.mocks.restoreRequests();
	});

	describe('.announce', () => {
		function commonTests() {
			it('should not error when called', async function () {
				await activitypub.out.announce.topic(this.tid, this.uid);
				await wait(50);
				const { payload, targets } = Array.from(activitypub._sent).pop()[1];
				this.payload = payload;
				this.targets = targets;
			});

			it('should send an Announce activity', function () {
				assert.strictEqual(activitypub._sent.size, 1);
				assert.strictEqual(this.payload.type, 'Announce');
			});

			it('should contain the main post\'s pid in object', function () {
				assert.strictEqual(this.payload.object, this.pid);
			});

			it('should have actor as the calling user or category as appropriate', function () {
				if (this.uid) {
					assert.strictEqual(this.payload.actor, `${nconf.get('url')}/uid/${this.uid}`);
				} else {
					assert.strictEqual(this.payload.actor, `${nconf.get('url')}/category/${this.cid}`);
				}
			});
		}

		describe('.topic() (remote topic; by cid)', () => {
			before(async function () {
				const { id: pid, note } = helpers.mocks.note();
				const { cid } = await categories.create({ name: utils.generateUUID() });
				await activitypub.notes.assert(0, pid, { skipChecks: 1, cid });

				this.pid = pid;
				this.note = note;
				this.cid = cid;
				this.tid = await posts.getPostField(pid, 'tid');
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();

			it('should include the category\'s followers collection in cc', function () {
				assert(this.payload.cc.includes(`${nconf.get('url')}/category/${this.cid}/followers`));
			});

			it('should include the author in cc', function () {
				assert(this.payload.cc.includes(this.note.attributedTo));
			});

			it('should include the author in targets', function () {
				assert(this.targets.includes(this.note.attributedTo));
			});
		});

		describe('.topic() (local topic; by cid)', () => {
			before(async function () {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const { cid } = await categories.create({ name: utils.generateUUID() });
				const { postData, topicData } = await topics.post({
					cid, uid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});

				this.tid = topicData.tid;
				this.cid = cid;
				this.pid = `${nconf.get('url')}/post/${topicData.mainPid}`;
				this.note = await activitypub.mocks.notes.public(postData);
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();

			it('should include the topic\'s mainPid in object', async function () {
				const mainPid = await topics.getTopicField(this.tid, 'mainPid');
				assert.strictEqual(this.payload.object, `${nconf.get('url')}/post/${mainPid}`);
			});
		});

		describe('.topic() (remote topic; by uid)', () => {
			before(async function () {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const { id: pid, note } = helpers.mocks.note();

				await activitypub.notes.assert(0, pid, { skipChecks: 1 });

				this.pid = pid;
				this.note = note;
				this.tid = await posts.getPostField(pid, 'tid');
				this.uid = uid;
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();
		});

		describe('.topic() (local topic; by uid)', () => {
			before(async function () {
				const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const { cid } = await categories.create({ name: utils.generateUUID() });
				const { postData, topicData } = await topics.post({
					cid, uid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});

				this.tid = topicData.tid;
				this.cid = cid;
				this.pid = `${nconf.get('url')}/post/${topicData.mainPid}`;
				this.note = await activitypub.mocks.notes.public(postData);
				this.uid = uid;
			});

			after(() => {
				activitypub._sent.clear();
			});

			commonTests();
		});
	});

	describe('.privateNote', () => {
		describe('.delete()', () => {
			before(async function () {
				// Create a local user and a remote actor
				this.localUid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const remote = helpers.mocks.person();
				this.remoteId = remote.id;

				// Create a private chat room between the local user and the remote actor
				this.roomId = await messaging.newRoom(this.localUid, { uids: [this.remoteId] });

				// Send a chat message from the local user
				const messageData = await messaging.sendMessage({
					uid: this.localUid,
					roomId: this.roomId,
					content: 'Test message to delete',
				});
				this.mid = messageData.mid;
				this.messageObj = {
					mid: this.mid,
					fromuid: this.localUid,
					roomId: this.roomId,
					deleted: 0,
				};
			});

			after(() => {
				activitypub._sent.clear();
			});

			it('should send a Delete activity when deleting a message', async function () {
				await activitypub.out.delete.privateNote(this.localUid, this.messageObj);
				await wait(50);

				assert.strictEqual(activitypub._sent.size, 1);
				const { payload } = Array.from(activitypub._sent).pop()[1];

				assert.strictEqual(payload.type, 'Delete');
				assert.strictEqual(payload.object, `${nconf.get('url')}/message/${this.mid}`);
				assert(payload.actor.startsWith(`${nconf.get('url')}/uid/`));
			});

			it('should send the Delete only to remote users in the room', async function () {
				const { targets } = Array.from(activitypub._sent).pop()[1];

				// Should include the remote actor
				assert(targets.includes(this.remoteId));

				// Should NOT include the local user
				const localUrl = `${nconf.get('url')}/uid/${this.localUid}`;
				assert(!targets.includes(this.localUid));
				assert(!targets.includes(localUrl));
			});

			it('should not send any activity when mid is not a number', async function () {
				activitypub._sent.clear();
				await activitypub.out.delete.privateNote(this.localUid, { mid: 'not-a-number', roomId: this.roomId });
				await wait(50);

				assert.strictEqual(activitypub._sent.size, 0);
			});

			it('should not federate an Update when deleting a message', async function () {
				activitypub._sent.clear();

				await activitypub.out.delete.privateNote(this.localUid, this.messageObj);
				await wait(50);

				const activities = Array.from(activitypub._sent).map(([, { payload }]) => payload.type);

				assert.strictEqual(activities.filter(t => t === 'Delete').length, 1);
				assert.strictEqual(activities.filter(t => t === 'Update').length, 0);
			});
		});

		describe('.update()', () => {
			before(async function () {
				// Create a local user and a remote actor
				this.localUid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				const remote = helpers.mocks.person();
				this.remoteId = remote.id;

				// Create a private chat room between the local user and the remote actor
				this.roomId = await messaging.newRoom(this.localUid, { uids: [this.remoteId] });

				// Send a chat message from the local user
				const messageData = await messaging.sendMessage({
					uid: this.localUid,
					roomId: this.roomId,
					content: 'Test message to update',
				});
				this.mid = messageData.mid;
				this.messageObj = {
					mid: this.mid,
					fromuid: this.localUid,
					roomId: this.roomId,
					deleted: 0,
				};
			});

			after(() => {
				activitypub._sent.clear();
			});

			it('should send an Update activity when updating a message', async function () {
				await activitypub.out.update.privateNote(this.localUid, this.messageObj);
				await wait(50);

				assert.strictEqual(activitypub._sent.size, 1);
				const { payload } = Array.from(activitypub._sent).pop()[1];

				assert.strictEqual(payload.type, 'Update');
			});
		});
	});

	describe('.lock', () => {
		before(async function () {
			this.uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			this.remoteActor = helpers.mocks.person();

			const { cid } = await categories.create({ name: utils.generateUUID() });
			this.cid = cid;
			this.tid = await db.incrObjectField('global', 'nextTid');

			// Create the topic hash
			const topicData = {
				tid: this.tid,
				uid: this.uid,
				cid: this.cid,
				mainPid: 0,
				title: 'Test Topic',
				slug: `${this.tid}/test-topic`,
				timestamp: Date.now(),
				lastposttime: 0,
				postcount: 0,
				viewcount: 0,
			};
			await db.setObject(`topic:${this.tid}`, topicData);

			// Add a remote user to the topic posters set
			await db.sortedSetAdd(`tid:${this.tid}:posters`, Date.now(), this.remoteActor.id);

			// Add remote user as a category follower
			await db.sortedSetAdd(`cid:${this.cid}:uid:watch:state`, Date.now(), this.remoteActor.id);

			// Create a local post in the topic
			const mainPid = await db.incrObjectField('global', 'nextPid');
			await db.setObject(`post:${mainPid}`, {
				pid: mainPid,
				uid: this.uid,
				tid: this.tid,
				cid: this.cid,
				content: 'Test content',
			});
			await db.setObjectField(`topic:${this.tid}`, 'mainPid', mainPid);
			this.pid = `${nconf.get('url')}/post/${mainPid}`;
		});

		after(() => {
			activitypub._sent.clear();
		});

		it('should send a Lock activity when locking a topic', async function () {
			await activitypub.out.lock(this.uid, this.tid);
			await wait(50);

			assert.strictEqual(activitypub._sent.size, 1);
			const { payload } = Array.from(activitypub._sent).pop()[1];

			assert.strictEqual(payload.type, 'Lock');
			assert.strictEqual(payload.actor, `${nconf.get('url')}/uid/${this.uid}`);
			assert.strictEqual(payload.object, `${nconf.get('url')}/topic/${this.tid}`);
			assert.strictEqual(payload.audience, `${nconf.get('url')}/category/${this.cid}`);
			assert(payload.id.includes(`/topic/${this.tid}#activity/lock/`));
		});

		it('should include the category followers collection in cc', function () {
			const { payload } = Array.from(activitypub._sent).pop()[1];
			assert(payload.cc.includes(`${nconf.get('url')}/category/${this.cid}/followers`));
		});

		it('should include remote topic participants in targets', function () {
			const { targets } = Array.from(activitypub._sent).pop()[1];
			assert(targets.includes(this.remoteActor.id));
		});

		it('should not federate when topic is in a non-local category', async function () {
			activitypub._sent.clear();

			const { cid } = await categories.create({ name: utils.generateUUID() });
			await db.setObjectField(`topic:${this.tid}`, 'cid', -1);

			await activitypub.out.lock(this.uid, this.tid);
			await wait(50);

			assert.strictEqual(activitypub._sent.size, 0);
		});

		describe('non-local category', () => {
			before(async function () {
				await db.setObjectField(`topic:${this.tid}`, 'cid', -1);
				activitypub._sent.clear();
			});

			it('should not send any activity when cid is -1', async function () {
				await activitypub.out.lock(this.uid, this.tid);
				await wait(50);

				assert.strictEqual(activitypub._sent.size, 0);
			});
		});
	});

	describe('.unlock', () => {
		before(async function () {
			this.uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			this.remoteActor = helpers.mocks.person();

			const { cid } = await categories.create({ name: utils.generateUUID() });
			this.cid = cid;
			this.tid = await db.incrObjectField('global', 'nextTid');

			const topicData = {
				tid: this.tid,
				uid: this.uid,
				cid: this.cid,
				mainPid: 0,
				title: 'Test Topic',
				slug: `${this.tid}/test-topic`,
				timestamp: Date.now(),
				lastposttime: 0,
				postcount: 0,
				viewcount: 0,
			};
			await db.setObject(`topic:${this.tid}`, topicData);

			await db.sortedSetAdd(`tid:${this.tid}:posters`, Date.now(), this.remoteActor.id);
			await db.sortedSetAdd(`cid:${this.cid}:uid:watch:state`, Date.now(), this.remoteActor.id);

			const mainPid = await db.incrObjectField('global', 'nextPid');
			await db.setObject(`post:${mainPid}`, {
				pid: mainPid,
				uid: this.uid,
				tid: this.tid,
				cid: this.cid,
				content: 'Test content',
			});
			await db.setObjectField(`topic:${this.tid}`, 'mainPid', mainPid);
			this.pid = `${nconf.get('url')}/post/${mainPid}`;
		});

		after(() => {
			activitypub._sent.clear();
		});

		it('should send an Unlock activity when unlocking a topic', async function () {
			await activitypub.out.unlock(this.uid, this.tid);
			await wait(50);

			assert.strictEqual(activitypub._sent.size, 1);
			const { payload } = Array.from(activitypub._sent).pop()[1];

			assert.strictEqual(payload.type, 'Unlock');
			assert.strictEqual(payload.actor, `${nconf.get('url')}/uid/${this.uid}`);
			assert.strictEqual(payload.object, `${nconf.get('url')}/topic/${this.tid}`);
			assert.strictEqual(payload.audience, `${nconf.get('url')}/category/${this.cid}`);
			assert(payload.id.includes(`/topic/${this.tid}#activity/unlock/`));
		});

		it('should include the category followers collection in cc', function () {
			const { payload } = Array.from(activitypub._sent).pop()[1];
			assert(payload.cc.includes(`${nconf.get('url')}/category/${this.cid}/followers`));
		});

		it('should include remote topic participants in targets', function () {
			const { targets } = Array.from(activitypub._sent).pop()[1];
			assert(targets.includes(this.remoteActor.id));
		});
	});
});