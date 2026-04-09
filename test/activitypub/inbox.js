'use strict';

const assert = require('assert');
const nconf = require('nconf');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const install = require('../../src/install');
const user = require('../../src/user');
const categories = require('../../src/categories');
const topics = require('../../src/topics');
const posts = require('../../src/posts');
const privileges = require('../../src/privileges');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

const helpers = require('./helpers');

describe('Inbox', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	describe('Inbox handling', () => {
		describe('helper self-check', () => {
			it('should generate a Like activity', () => {
				const object = utils.generateUUID();
				const { id: actor } = helpers.mocks.person();
				const { activity } = helpers.mocks.like({
					object,
					actor,
				});

				assert.deepStrictEqual(activity, {
					'@context': 'https://www.w3.org/ns/activitystreams',
					id: `${helpers.mocks._baseUrl}/like/${encodeURIComponent(object)}`,
					type: 'Like',
					actor,
					object,
				});
			});

			it('should generate an Announce activity wrapping a Like activity', () => {
				const object = utils.generateUUID();
				const { id: actor } = helpers.mocks.person();
				const { activity: like } = helpers.mocks.like({
					object,
					actor,
				});
				const { id: gActor } = helpers.mocks.group();
				const { activity } = helpers.mocks.announce({
					actor: gActor,
					object: like,
				});

				assert.deepStrictEqual(activity, {
					'@context': 'https://www.w3.org/ns/activitystreams',
					id: `${helpers.mocks._baseUrl}/announce/${encodeURIComponent(like.id)}`,
					type: 'Announce',
					to: [ 'https://www.w3.org/ns/activitystreams#Public' ],
					cc: [
						`${gActor}/followers`,
					],
					actor: gActor,
					object: like,
				});
			});
		});

		describe('from a banned account', () => {
			before(async function () {
				const { id: bannedUid } = helpers.mocks.person();
				this.bannedUid = bannedUid;

				const { note } = helpers.mocks.note({
					attributedTo: bannedUid,
				});

				const uid = await user.create({ username: utils.generateUUID() });
				const { id: boosterUid } = helpers.mocks.person();
				await db.sortedSetAdd(`followersRemote:${boosterUid}`, Date.now(), uid);
				const { activity } = helpers.mocks.announce({
					actor: boosterUid,
					object: note,
				});
				this.activity = activity;
				this.pid = note.id;

				await user.bans.ban(bannedUid, 0, 'testing');
			});

			it('should list the remote user as banned, when queried', async function () {
				const isBanned = await user.bans.isBanned(this.bannedUid);
				assert.strictEqual(isBanned, true);
			});

			// Can't actually test the middleware because I can't sign a request for a test

			it('should not assert a note if authored by a banned user (boosted by third-party)', async function () {
				await activitypub.inbox.announce({
					body: this.activity,
				});

				const exists = await posts.exists(this.pid);
				assert.strictEqual(exists, false);
			});
		});

		describe('Create', () => {
			let uid;

			before(async () => {
				uid = await user.create({ username: utils.generateUUID() });
			});

			describe('(Note)', () => {
				it('should create a new topic in cid -1', async () => {
					const { note, id } = helpers.mocks.note();
					const { activity } = helpers.mocks.create(note);

					await db.sortedSetAdd(`followersRemote:${note.attributedTo}`, Date.now(), uid);
					await activitypub.inbox.create({ body: activity });

					assert(await posts.exists(id));

					const cid = await posts.getCidByPid(id);
					assert.strictEqual(cid, -1);
				});

				it('should not append to the tids_read sorted set', async () => {
					const { note, id } = helpers.mocks.note();
					const { activity } = helpers.mocks.create(note);

					await db.sortedSetAdd(`followersRemote:${note.attributedTo}`, Date.now(), uid);
					await activitypub.inbox.create({ body: activity });

					const exists = await db.exists(`uid:${note.attributedTo}:tids_read`);
					assert(!exists);
				});

				it('should create a new topic in a remote category if addressed (category same-origin)', async () => {
					const { id: remoteCid } = helpers.mocks.group();
					const { note, id } = helpers.mocks.note({
						audience: [remoteCid],
					});
					const { activity } = helpers.mocks.create(note);

					await activitypub.inbox.create({ body: activity });

					assert(await posts.exists(id));

					const cid = await posts.getCidByPid(id);
					assert.strictEqual(cid, remoteCid);
				});

				it('should create a new topic in cid -1 if a non-same origin remote category is addressed', async function () {
					const uid = await user.create({ username: utils.generateUUID() });
					const { id: remoteCid } = helpers.mocks.group({
						id: `https://example.com/${utils.generateUUID()}`,
					});
					const { note, id } = helpers.mocks.note({
						to: [remoteCid, activitypub._constants.publicAddress],
					});
					const { activity } = helpers.mocks.create(note);
					try {
						await activitypub.inbox.create({ uid, body: activity });
					} catch (err) {
						assert(false);
					}

					assert(await posts.exists(id));
					const cid = await posts.getCidByPid(id);
					assert.strictEqual(cid, -1);
				});
			});
		});

		describe('Announce', () => {
			let cid;

			before(async () => {
				({ cid } = await categories.create({ name: utils.generateUUID() }));
			});

			describe('(Create)', () => {
				describe('newly-discovered topic', () => {
					before(async function () {
						const { id: remoteCid } = helpers.mocks.group();
						const { id, note } = helpers.mocks.note({
							audience: [remoteCid],
						});
						this.id = id;
						this.remoteCid = remoteCid;
						let { activity } = helpers.mocks.create(note);
						({ activity } = helpers.mocks.announce({ actor: remoteCid, object: activity }));

						await activitypub.inbox.announce({ body: activity });
					});

					it('should create a new topic in a remote category if addressed', async function () {
						assert(await posts.exists(this.id));

						const cid = await posts.getCidByPid(this.id);
						assert.strictEqual(cid, this.remoteCid);
					});
				});

				describe('known topic in cid -1 (author domain != announcer domain)', async () => {
					/**
					 * This happens if follower receives object from microblog user before the community announces it.
					 * It's probably more likely to occur because the Create(Note) is a single hop whereas the reflected
					 * Announce(Create(Note)) takes two hops.
					 *
					 * If the author and announcer domain are the same, the object should already be correctly classified.
					 */
					before(async function () {
						const { id: remoteCid } = helpers.mocks.group({
							id: `https://example.social/${utils.generateUUID()}`,
						});
						await activitypub.actors.assertGroup([remoteCid]);
						const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });

						this.uid = uid;
						this.remoteCid = remoteCid;
					});

					it('should create a topic in cid -1', async function () {
						const { id, note } = helpers.mocks.note({
							to: [activitypub._constants.publicAddress, this.remoteCid],
						});

						const { activity } = helpers.mocks.create(note);
						await activitypub.inbox.create({ uid: this.uid, body: activity });

						this.id = id;
						this.note = note;
						this.activity = activity;

						const cid = await posts.getCidByPid(this.id);
						assert.strictEqual(cid, -1);
					});

					it('should handle the Announce(Create) from the remote category', async function () {
						const { activity } = helpers.mocks.announce({ actor: this.remoteCid, object: this.activity });
						await activitypub.inbox.announce({ uid: this.uid, body: activity });
					});

					it('should be categorized in the remote category', async function () {
						const cid = await posts.getCidByPid(this.id);
						assert.strictEqual(cid, this.remoteCid);
					});
				});
			});

			describe('(Create) or (Note) referencing local post', () => {
				let uid;
				let topicData;
				let postData;
				let localNote;
				let announces = 0;

				before(async () => {
					uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					({ topicData, postData } = await topics.post({
						cid,
						uid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					}));
					localNote = await activitypub.mocks.notes.public(postData);
				});

				it('should increment announces counter when a remote user shares', async () => {
					const { id } = helpers.mocks.person();
					const { activity } = helpers.mocks.announce({
						actor: id,
						object: localNote,
						cc: [`${nconf.get('url')}/uid/${topicData.uid}`],
					});

					await activitypub.inbox.announce({ body: activity });
					announces += 1;

					const count = await posts.getPostField(topicData.mainPid, 'announces');
					assert.strictEqual(count, announces);
				});

				it('should contain the remote user announcer id in the post announces zset', async () => {
					const { id } = helpers.mocks.person();
					const { activity } = helpers.mocks.announce({
						actor: id,
						object: localNote,
						cc: [`${nconf.get('url')}/uid/${topicData.uid}`],
					});

					await activitypub.inbox.announce({ body: activity });
					announces += 1;

					const exists = await db.isSortedSetMember(`pid:${topicData.mainPid}:announces`, id);
					assert(exists);
				});

				it('should NOT increment announces counter when a remote category shares', async () => {
					const { id } = helpers.mocks.group();
					const { activity } = helpers.mocks.announce({
						actor: id,
						object: localNote,
						cc: [`${nconf.get('url')}/uid/${topicData.uid}`],
					});

					await activitypub.inbox.announce({ body: activity });

					const count = await posts.getPostField(topicData.mainPid, 'announces');
					assert.strictEqual(count, announces);
				});

				it('should NOT contain the remote category announcer id in the post announces zset', async () => {
					const { id } = helpers.mocks.group();
					const { activity } = helpers.mocks.announce({
						actor: id,
						object: localNote,
						cc: [`${nconf.get('url')}/uid/${topicData.uid}`],
					});

					await activitypub.inbox.announce({ body: activity });

					const exists = await db.isSortedSetMember(`pid:${topicData.mainPid}:announces`, id);
					assert(!exists);
				});
			});

			describe('(Note)', () => {
				it('should create a new topic in cid -1 if category not addressed', async () => {
					const { note } = helpers.mocks.note();
					await activitypub.actors.assert([note.attributedTo]);
					const { activity } = helpers.mocks.announce({
						object: note,
					});
					const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					await db.sortedSetAdd(`followersRemote:${activity.actor}`, Date.now(), uid);

					const beforeCount = await db.sortedSetCard(`cid:-1:tids`);
					await activitypub.inbox.announce({ body: activity });
					const count = await db.sortedSetCard(`cid:-1:tids`);

					assert.strictEqual(count, beforeCount + 1);
				});

				it('should create a new topic in local category', async () => {
					const { note } = helpers.mocks.note({
						cc: [`${nconf.get('url')}/category/${cid}`],
					});
					await activitypub.actors.assert([note.attributedTo]);
					const { activity } = helpers.mocks.announce({
						object: note,
					});
					const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					await db.sortedSetAdd(`followersRemote:${activity.actor}`, Date.now(), uid);

					const beforeCount = await db.sortedSetCard(`cid:${cid}:tids`);
					await activitypub.inbox.announce({ body: activity });
					const count = await db.sortedSetCard(`cid:${cid}:tids`);

					assert.strictEqual(count, beforeCount + 1);
				});
			});

			describe('(Like)', () => {
				it('should upvote a local post', async () => {
					const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					const { postData } = await topics.post({
						cid,
						uid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});

					const { activity: like } = helpers.mocks.like({
						object: `${nconf.get('url')}/post/${postData.pid}`,
					});
					const { activity } = helpers.mocks.announce({
						object: like,
					});

					let { upvotes } = await posts.getPostFields(postData.pid, 'upvotes');
					assert.strictEqual(upvotes, 0);

					await activitypub.inbox.announce({ body: activity });
					({ upvotes } = await posts.getPostFields(postData.pid, 'upvotes'));
					assert.strictEqual(upvotes, 1);
				});

				it('should upvote an asserted remote post', async () => {
					const { id } = helpers.mocks.note();
					await activitypub.notes.assert(0, id, { skipChecks: true });
					const { activity: like } = helpers.mocks.like({
						object: id,
					});
					const { activity } = helpers.mocks.announce({
						object: like,
					});

					let { upvotes } = await posts.getPostFields(id, 'upvotes');
					assert.strictEqual(upvotes, 0);

					await activitypub.inbox.announce({ body: activity });

					({ upvotes } = await posts.getPostFields(id, 'upvotes'));
					assert.strictEqual(upvotes, 1);
				});
			});

			describe('(Update)', () => {
				it('should update a note\'s content', async () => {
					const { id: actor } = helpers.mocks.person();
					const { id, note } = helpers.mocks.note({ attributedTo: actor });
					await activitypub.notes.assert(0, id, { skipChecks: true });
					note.content = utils.generateUUID();
					const { activity: update } = helpers.mocks.update({ object: note });
					const { activity } = helpers.mocks.announce({ object: update });

					await activitypub.inbox.announce({ body: activity });

					const content = await posts.getPostField(id, 'content');
					assert.strictEqual(content, note.content);
				});
			});
		});

		describe('Like', () => {
			before(async function () {
				const uid = await user.create({ username: utils.generateUUID() });
				const { cid } = await categories.create({ name: utils.generateUUID() });
				this.cid = cid;
				const { postData } = await topics.post({
					uid,
					cid,
					title: utils.generateUUID(),
					content: utils.generateUUID(),
				});
				this.postData = postData;
				const object = await activitypub.mocks.notes.public(postData);
				const { activity } = helpers.mocks.like({ object });
				this.voterUid = activity.actor;
				await activitypub.inbox.like({ body: activity });
			});

			it('should increment a like for the post', async function () {
				const voted = await posts.hasVoted(this.postData.pid, this.voterUid);
				const count = await posts.getPostField(this.postData.pid, 'upvotes');
				assert(voted);
				assert.strictEqual(count, 1);
			});

			it('should not append to the uid upvotes zset', async function () {
				const exists = await db.exists(`uid:${this.voterUid}:upvote`);
				assert(!exists);
			});

			describe('with privilege revoked (from fediverse pseudo-user)', () => {
				before(async function () {
					await privileges.categories.rescind(['groups:posts:upvote'], this.cid, 'fediverse');
					const object = await activitypub.mocks.notes.public(this.postData);
					const { activity } = helpers.mocks.like({ object });
					this.voterUid = activity.actor;
					try {
						await activitypub.inbox.like({ body: activity });
					} catch (e) {
						// expected
					}
				});

				after(async function () {
					await privileges.categories.give(['groups:posts:upvote'], this.cid, 'fediverse');
				});

				it('should not increment a like for the post', async function () {
					const { upvoted } = await posts.hasVoted(this.postData.pid, this.voterUid);
					const count = await posts.getPostField(this.postData.pid, 'upvotes');
					assert.strictEqual(upvoted, false);
					assert.strictEqual(count, 1);
				});
			});
		});
	});

	describe('Inbox Synchronization', () => {
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

		it('should add a topic to a user\'s inbox if user is a recipient in OP', async () => {
			await db.setAdd(`post:${topicData.mainPid}:recipients`, [uid]);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, true);
		});

		it('should add a topic to a user\'s inbox if a user is a recipient in a reply', async () => {
			const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			const { pid } = await topics.reply({
				tid: topicData.tid,
				uid,
				content: utils.generateUUID(),
			});
			await db.setAdd(`post:${pid}:recipients`, [uid]);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, true);
		});

		it('should maintain a list of recipients at the topic level', async () => {
			await db.setAdd(`post:${topicData.mainPid}:recipients`, [uid]);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const [isRecipient, count] = await Promise.all([
				db.isSetMember(`tid:${topicData.tid}:recipients`, uid),
				db.setCount(`tid:${topicData.tid}:recipients`),
			]);

			assert(isRecipient);
			assert.strictEqual(count, 1);
		});

		it('should add topic to a user\'s inbox if it is explicitly passed in as an argument', async () => {
			await activitypub.notes.syncUserInboxes(topicData.tid, uid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, true);
		});

		it('should remove a topic from a user\'s inbox if that user is no longer a recipient in any contained posts', async () => {
			await activitypub.notes.syncUserInboxes(topicData.tid, uid);
			await activitypub.notes.syncUserInboxes(topicData.tid);
			const inboxed = await db.isSortedSetMember(`uid:${uid}:inbox`, topicData.tid);

			assert.strictEqual(inboxed, false);
		});
	});
});
