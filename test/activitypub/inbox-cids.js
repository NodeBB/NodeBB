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
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');
const helpers = require('./helpers');

/**
 * Tests that verify the `uid:<uid>:cids` sorted set is correctly maintained
 * when a remote post arrives via the ActivityPub inbox.
 *
 * The `:cids` sorted set stores category IDs as members with timestamps as scores,
 * used to determine which categories a user has posted in (for the "Posts" tab
 * filtering).
 */
describe('Inbox – uid:<uid>:cids sorted set', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	/**
	 * Helper: manually construct a Create activity.
	 * helpers.mocks.create() hardcodes actor to 'https://example.org/user/foobar',
	 * so we can't use it when we need a custom actor.
	 */
	function makeCreateActivity(note) {
		const uuid = utils.generateUUID();
		const id = `${helpers.mocks._baseUrl}/activity/${uuid}`;
		return {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id,
			type: 'Create',
			to: ['https://www.w3.org/ns/activitystreams#Public'],
			cc: [`${note.attributedTo}/followers`],
			actor: note.attributedTo,
			object: note,
		};
	}

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
			const activity = makeCreateActivity(note);

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
			const activity = makeCreateActivity(note);

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
			const activity = makeCreateActivity(note);

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
			const activity1 = makeCreateActivity(note1);
			await activitypub.inbox.create({ body: activity1 });

			// Then post to cid2
			const { note: note2, id: id2 } = helpers.mocks.note({
				attributedTo: remoteActor,
				cc: [`${nconf.get('url')}/category/${cid2}`],
			});
			const activity2 = makeCreateActivity(note2);
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
			const createActivity = makeCreateActivity(note);
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
