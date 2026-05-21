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
const messaging = require('../../src/messaging');
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

			describe('(Delete)', () => {
				it('should delete a local post when announced', async () => {
					const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					const { id: cid } = helpers.mocks.group();
					await activitypub.actors.assertGroup(cid);
					const { postData } = await topics.post({
						uid,
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});

					// Create a delete activity for the local post
					const object = await activitypub.mocks.notes.public(postData);
					const { activity: deleteActivity } = helpers.mocks.delete({
						actor: `${nconf.get('url')}/uid/${postData.uid}`,
						object,
					});

					// Wrap it in an announce
					const { activity } = helpers.mocks.announce({
						actor: cid,
						object: deleteActivity,
					});

					// Verify post exists before deletion
					assert(await posts.exists(postData.pid));

					// Process the announce
					await activitypub.inbox.announce({ body: activity });

					// Verify post is deleted
					const isDeleted = await posts.getPostField(postData.pid, 'deleted');
					const exists = await posts.exists(postData.pid);
					assert.strictEqual(isDeleted, 1);
				});

				it('should delete a remote post when announced', async () => {
					const { id: cid } = helpers.mocks.group();

					// Create a remote note first
					const { id } = helpers.mocks.note({
						audience: [cid],
					});
					await activitypub.notes.assert(0, id, { skipChecks: true });

					// Verify it exists before deletion
					assert(await posts.exists(id));

					// Create a delete activity for the remote post
					const { activity: deleteActivity } = helpers.mocks.delete({
						actor: cid,
						object: id,
					});

					// Wrap it in an announce
					const { activity } = helpers.mocks.announce({
						actor: cid,
						object: deleteActivity,
					});

					// Process the announce
					await activitypub.inbox.announce({ body: activity });

					// Verify post is deleted
					const exists = await posts.exists(id);
					const isDeleted = await posts.getPostField(id, 'deleted');
					assert.strictEqual(isDeleted, 1);
				});

				it('should delete the topic if the post is the only post in the topic', async () => {
					const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					const { id: cid } = helpers.mocks.group();
					await activitypub.actors.assertGroup(cid);
					const { postData, topicData } = await topics.post({
						uid,
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});

					// Verify topic exists before deletion
					const topicExistsBefore = await topics.exists(topicData.tid);
					assert.strictEqual(topicExistsBefore, true);

					// Create a delete activity for the local post
					const object = await activitypub.mocks.notes.public(postData);
					const { activity: deleteActivity } = helpers.mocks.delete({
						actor: `${nconf.get('url')}/uid/${postData.uid}`,
						object,
					});

					// Wrap it in an announce
					const { activity } = helpers.mocks.announce({
						actor: cid,
						object: deleteActivity,
					});

					// Process the announce
					await activitypub.inbox.announce({ body: activity });

					// Verify post is deleted
					const isDeleted = await posts.getPostField(postData.pid, 'deleted');
					assert.strictEqual(isDeleted, 1);

					// Verify topic is also deleted
					const topicDeleted = await topics.getTopicField(topicData.tid, 'deleted');
					assert.strictEqual(topicDeleted, 1);
				});

				it('should NOT delete the topic if there are replies', async () => {
					const uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					const { id: cid } = helpers.mocks.group();
					await activitypub.actors.assertGroup(cid);
					const { postData, topicData } = await topics.post({
						uid,
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});

					// Add a reply to the topic
					await topics.reply({
						tid: topicData.tid,
						uid,
						content: utils.generateUUID(),
					});

					// Verify topic exists before deletion
					const topicExistsBefore = await topics.exists(topicData.tid);
					assert.strictEqual(topicExistsBefore, true);

					// Create a delete activity for the local post (main post)
					const object = await activitypub.mocks.notes.public(postData);
					const { activity: deleteActivity } = helpers.mocks.delete({
						actor: `${nconf.get('url')}/uid/${postData.uid}`,
						object,
					});

					// Wrap it in an announce
					const { activity } = helpers.mocks.announce({
						actor: cid,
						object: deleteActivity,
					});

					// Process the announce
					await activitypub.inbox.announce({ body: activity });

					// Verify post is deleted
					const isDeleted = await posts.getPostField(postData.pid, 'deleted');
					assert.strictEqual(isDeleted, 1);

					// Verify topic still exists (not deleted because there are replies)
					const topicExistsAfter = await topics.exists(topicData.tid);
					assert.strictEqual(topicExistsAfter, true);
				});
			});

			describe('(Delete) with non-public notes (aka chat messages)', () => {
				before(async function () {
					this.uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
					const remote = helpers.mocks.person();
					this.remoteId = remote.id;
					const result = await activitypub.actors.assert([remote.id]);

					// Create a private chat room between the users
					const { note } = helpers.mocks.note({
						attributedTo: remote.id,
						to: [`${nconf.get('url')}/uid/${this.uid}`],
						cc: [],
					});
					this.mid = note.id;
					const { roomId } = await activitypub.notes.assertPrivate(note);
					this.roomId = roomId;
				});

				it('should soft-delete a chat message via inbox.delete', async function () {
					// Verify message exists before deletion
					const existsBefore = await messaging.messageExists(this.mid);
					assert.strictEqual(existsBefore, true);
					const deletedBefore = await messaging.getMessageField(this.mid, 'deleted');
					assert.strictEqual(deletedBefore, 0);

					// Create a Delete activity for the chat message
					const { activity: deleteActivity } = helpers.mocks.delete({
						actor: this.remoteId,
						object: this.mid,
					});

					// Process the delete directly
					await activitypub.inbox.delete({ body: deleteActivity });

					// Verify message is soft-deleted
					const existsAfter = await messaging.messageExists(this.mid);
					assert.strictEqual(existsAfter, true);
					const deletedAfter = await messaging.getMessageField(this.mid, 'deleted');
					assert.strictEqual(deletedAfter, 1);
				});

				it('should do nothing when deleting a non-existent message', async function () {
					const { hostname } = new URL(this.remoteId);
					const fakeMid = `https://${hostname}/note/9999999999`;
					const { activity: deleteActivity } = helpers.mocks.delete({
						actor: this.remoteId,
						object: fakeMid,
					});

					// This should not throw – it should hit the default case
					await activitypub.inbox.delete({ body: deleteActivity });

					// Verify message still doesn't exist
					const exists = await messaging.messageExists(fakeMid);
					assert.strictEqual(exists, false);
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

	describe('Inbox – uid:<uid>:cids sorted set', () => {
		/**
		 * Tests that verify the `uid:<uid>:cids` sorted set is correctly maintained
		 * when a remote post arrives via the ActivityPub inbox.
		 *
		 * The `:cids` sorted set stores category IDs as members with timestamps as scores,
		 * used to determine which categories a user has posted in (for the "Posts" tab
		 * filtering).
		 */

		describe('Create (Note) – remote user posting to local cid -1', () => {
			let remoteActor;
			let localUid;
			let pid;

			before(async () => {
				remoteActor = `https://example.org/user/${utils.generateUUID().slice(0, 10)}`;
				localUid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				// Set up follower relationship so assertRelation passes
				await db.sortedSetAdd(`followersRemote:${remoteActor}`, Date.now(), localUid);

				const { note, id } = helpers.mocks.note({
					attributedTo: remoteActor,
				});
				const { activity } = helpers.mocks.create({ actor: remoteActor, object: note });

				await activitypub.inbox.create({ body: activity });

				pid = id;
			});

			it('should create the post', async () => {
				assert(await posts.exists(pid));
			});

			it('should place the post in cid -1', async () => {
				const cid = await posts.getCidByPid(pid);
				assert.strictEqual(cid, -1);
			});

			it('should append the cid to the remote user\'s :cids sorted set', async () => {
				const isMember = await db.isSortedSetMember(`uid:${remoteActor}:cids`, -1);
				assert(isMember);
			});

			it('should have incremented the counter in the :cids sorted set', async () => {
				const score = await db.sortedSetScore(`uid:${remoteActor}:cids`, -1);
				assert(score > 0);
			});
		});

		describe('Create (Note) – remote user posting to a local category', () => {
			let remoteActor;
			let localUid;
			let cid;
			let pid;

			before(async () => {
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				remoteActor = `https://example.org/user/${utils.generateUUID().slice(0, 10)}`;
				localUid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				await db.sortedSetAdd(`followersRemote:${remoteActor}`, Date.now(), localUid);

				const { note, id } = helpers.mocks.note({
					attributedTo: remoteActor,
					cc: [`${nconf.get('url')}/category/${cid}`],
				});
				const { activity } = helpers.mocks.create({ actor: remoteActor, object: note });

				await activitypub.inbox.create({ body: activity });

				pid = id;
			});

			it('should create the post', async () => {
				assert(await posts.exists(pid));
			});

			it('should place the post in the specified local category', async () => {
				const postCid = await posts.getCidByPid(pid);
				assert.strictEqual(postCid, cid);
			});

			it('should append the cid to the remote user\'s :cids sorted set', async () => {
				const isMember = await db.isSortedSetMember(`uid:${remoteActor}:cids`, String(cid));
				assert(isMember);
			});

			it('should have incremented the counter in the :cids sorted set', async () => {
				const score = await db.sortedSetScore(`uid:${remoteActor}:cids`, String(cid));
				assert(score > 0);
			});
		});

		describe('Create (Note) – remote user posting to a remote category', () => {
			let remoteActor;
			let localUid;
			let remoteCid;
			let pid;

			before(async () => {
				remoteActor = `https://example.org/user/${utils.generateUUID().slice(0, 10)}`;
				localUid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				// Use helpers.mocks.group() to generate a consistent remote category ID, then assert it
				({ id: remoteCid } = helpers.mocks.group());
				await activitypub.actors.assertGroup([remoteCid]);
				await db.sortedSetAdd(`followersRemote:${remoteActor}`, Date.now(), localUid);

				const { note, id } = helpers.mocks.note({
					attributedTo: remoteActor,
					audience: [remoteCid],
				});
				const { activity } = helpers.mocks.create({ actor: remoteActor, object: note });

				await activitypub.inbox.create({ body: activity });

				pid = id;
			});

			it('should create the post', async () => {
				assert(await posts.exists(pid));
			});

			it('should place the post in the remote category', async () => {
				const postCid = await posts.getCidByPid(pid);
				assert.strictEqual(postCid, remoteCid);
			});

			it('should append the remote cid to the remote user\'s :cids sorted set', async () => {
				const isMember = await db.isSortedSetMember(`uid:${remoteActor}:cids`, remoteCid);
				assert(isMember);
			});

			it('should have incremented the counter in the :cids sorted set', async () => {
				const score = await db.sortedSetScore(`uid:${remoteActor}:cids`, remoteCid);
				assert(score > 0);
			});
		});

		describe('Create (Note) – remote user posting to multiple categories', () => {
			let remoteActor;
			let localUid;
			let cid1;
			let cid2;

			before(async () => {
				remoteActor = `https://example.org/user/${utils.generateUUID().slice(0, 10)}`;
				localUid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				({ cid: cid1 } = await categories.create({ name: utils.generateUUID() }));
				({ cid: cid2 } = await categories.create({ name: utils.generateUUID() }));
				await db.sortedSetAdd(`followersRemote:${remoteActor}`, Date.now(), localUid);

				// First post to cid1
				const { note: note1, id: id1 } = helpers.mocks.note({
					attributedTo: remoteActor,
					cc: [`${nconf.get('url')}/category/${cid1}`],
				});
				const { activity: activity1 } = helpers.mocks.create({ actor: remoteActor, object: note1 });
				await activitypub.inbox.create({ body: activity1 });

				// Then post to cid2
				const { note: note2, id: id2 } = helpers.mocks.note({
					attributedTo: remoteActor,
					cc: [`${nconf.get('url')}/category/${cid2}`],
				});
				const { activity: activity2 } = helpers.mocks.create({ actor: remoteActor, object: note2 });
				await activitypub.inbox.create({ body: activity2 });
			});

			it('should have both cids in the sorted set', async () => {
				const isMember1 = await db.isSortedSetMember(`uid:${remoteActor}:cids`, String(cid1));
				const isMember2 = await db.isSortedSetMember(`uid:${remoteActor}:cids`, String(cid2));
				assert(isMember1);
				assert(isMember2);
			});

			it('should have correct counters for each cid', async () => {
				const score1 = await db.sortedSetScore(`uid:${remoteActor}:cids`, String(cid1));
				const score2 = await db.sortedSetScore(`uid:${remoteActor}:cids`, String(cid2));
				assert.strictEqual(score1, 1);
				assert.strictEqual(score2, 1);
			});

			it('should have a total card matching the number of categories', async () => {
				const card = await db.sortedSetCard(`uid:${remoteActor}:cids`);
				assert.strictEqual(card, 2);
			});
		});

		describe('Announce (Create) – remote user sharing a topic to local cid', () => {
			let remoteActor;
			let localUid;
			let cid;
			let remoteTid;

			before(async () => {
				({ cid } = await categories.create({ name: utils.generateUUID() }));
				remoteActor = `https://example.org/user/${utils.generateUUID().slice(0, 10)}`;
				localUid = await user.create({ username: utils.generateUUID().slice(0, 10) });
				await db.sortedSetAdd(`followersRemote:${remoteActor}`, Date.now(), localUid);

				// Create a remote note that will be announced into this category
				const { note, id } = helpers.mocks.note({
					attributedTo: remoteActor,
					cc: [`${nconf.get('url')}/category/${cid}`],
				});
				const { activity: createActivity } = helpers.mocks.create({ actor: remoteActor, object: note });
				await activitypub.inbox.create({ body: createActivity });

				remoteTid = id;
			});

			it('should have the cid in the remote user\'s :cids sorted set', async () => {
				const isMember = await db.isSortedSetMember(`uid:${remoteActor}:cids`, String(cid));
				assert(isMember);
			});

			it('should have a positive counter for the cid', async () => {
				const score = await db.sortedSetScore(`uid:${remoteActor}:cids`, String(cid));
				assert(score > 0);
			});
		});
	});
});
