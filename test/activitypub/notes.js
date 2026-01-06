'use strict';

const assert = require('assert');
const nconf = require('nconf');

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

					const key = Array.from(activitypub._sent.keys())[0];
					activity = activitypub._sent.get(key);
				});

				it('should federate out an activity with object of type "Note"', () => {
					assert(activity.payload && activity.payload.object && activity.payload.object.type);
					assert.strictEqual(activity.payload.object.type, 'Note');
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

		describe('Create', () => {
			let uid;
			let cid;

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
					const { id: remoteCid } = helpers.mocks.group({
						id: `https://example.com/${utils.generateUUID()}`,
					});
					const { note, id } = helpers.mocks.note({
						audience: [remoteCid],
					});
					const { activity } = helpers.mocks.create(note);
					try {
						await activitypub.inbox.create({ body: activity });
					} catch (err) {
						assert(false);
					}

					assert(await posts.exists(id));
					const cid = await posts.getCidByPid(id);
					assert.strictEqual(cid, -1);
				});
			});

			describe('(Like)', () => {
				let pid;
				let voterUid;

				before(async () => {
					({ cid } = await categories.create({ name: utils.generateUUID() }));
					const { postData } = await topics.post({
						uid,
						cid,
						title: utils.generateUUID(),
						content: utils.generateUUID(),
					});
					pid = postData.pid;
					const object = await activitypub.mocks.notes.public(postData);
					const { activity } = helpers.mocks.like({ object });
					voterUid = activity.actor;
					await activitypub.inbox.like({ body: activity });
				});

				it('should increment a like for the post', async () => {
					const voted = await posts.hasVoted(pid, voterUid);
					const count = await posts.getPostField(pid, 'upvotes');
					assert(voted);
					assert.strictEqual(count, 1);
				});

				it('should not append to the uid upvotes zset', async () => {
					const exists = await db.exists(`uid:${voterUid}:upvote`);
					assert(!exists);
				});
			});
		});

		describe('Announce', () => {
			let cid;

			before(async () => {
				({ cid } = await categories.create({ name: utils.generateUUID() }));
			});

			describe('(Create)', () => {
				it('should create a new topic in a remote category if addressed', async () => {
					const { id: remoteCid } = helpers.mocks.group();
					const { id, note } = helpers.mocks.note({
						audience: [remoteCid],
					});
					let { activity } = helpers.mocks.create(note);
					({ activity } = helpers.mocks.announce({ actor: remoteCid, object: activity }));

					await activitypub.inbox.announce({ body: activity });

					assert(await posts.exists(id));

					const cid = await posts.getCidByPid(id);
					assert.strictEqual(cid, remoteCid);
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
