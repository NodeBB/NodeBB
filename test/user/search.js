'use strict';

const assert = require('assert');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const install = require('../../src/install');
const user = require('../../src/user');
const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');

const helpers = require('../activitypub/helpers');

describe('User.search()', () => {
	before(async () => {
		meta.config.activitypubEnabled = 1;
		await install.giveWorldPrivileges();
	});

	describe('partial query returns both local and remote users', () => {
		let localUid;
		let remoteActorUri;

		before(async () => {
			// Create a local user with username "alice"
			localUid = await user.create({
				username: 'alice',
				password: 'password123',
				email: 'alice@example.com',
			});

			// Create a remote actor with preferredUsername "alice"
			// This simulates a remote user alice@somewhere.org
			const { id, actor } = helpers.mocks.person({
				preferredUsername: 'alice',
				name: 'Alice Remote',
			});
			remoteActorUri = id;

			// Assert the remote actor so it gets indexed into ap.preferredUsername:sorted
			await activitypub.actors.assert([remoteActorUri]);
		});

		it('should return both local and remote users for partial query', async () => {
			const result = await user.search({
				query: 'ali',
				searchBy: 'username',
				uid: localUid,
			});

			assert.ok(result.users.length >= 2, `expected at least 2 users, got ${result.users.length}`);

			const usernames = result.users.map(u => u.username);
			assert.ok(usernames.includes('alice'), 'local user "alice" should be in results');

			// Remote user should also be present
			const remoteUser = result.users.find(u => u.uid === remoteActorUri);
			assert.ok(remoteUser, 'remote user should be in results');
		});

		it('should return both local and remote users for exact prefix query', async () => {
			const result = await user.search({
				query: 'alice',
				searchBy: 'username',
				uid: localUid,
			});

			assert.ok(result.users.length >= 2, `expected at least 2 users, got ${result.users.length}`);

			const hasLocal = result.users.some(u => u.uid === localUid);
			assert.ok(hasLocal, 'local user should be in results');

			const hasRemote = result.users.some(u => u.uid === remoteActorUri);
			assert.ok(hasRemote, 'remote user should be in results');
		});

		it('should return only local user when remote has no matching name', async () => {
			// Create another local user with a unique name
			const bobUid = await user.create({
				username: 'bob',
				password: 'password123',
				email: 'bob@example.com',
			});

			const result = await user.search({
				query: 'bob',
				searchBy: 'username',
				uid: localUid,
			});

			assert.strictEqual(result.users.length, 1);
			assert.strictEqual(result.users[0].uid, bobUid);
		});

		it('should return only remote user when no local match exists', async () => {
			const result = await user.search({
				query: 'alice remote',
				searchBy: 'fullname',
				uid: localUid,
			});

			// Remote user has name "Alice Remote" which is indexed in ap.name:sorted
			const hasRemote = result.users.some(u => u.uid === remoteActorUri);
			assert.ok(hasRemote, 'remote user should be found by fullname search');
		});

		it('should return remote user when searching by ap.preferredUsername', async () => {
			const result = await user.search({
				query: 'ali',
				searchBy: 'ap.preferredUsername',
				uid: localUid,
			});

			const hasRemote = result.users.some(u => u.uid === remoteActorUri);
			assert.ok(hasRemote, 'remote user should be found when searching ap.preferredUsername directly');
		});
	});

	describe('exact webfinger query resolves to single user', () => {
		let localUid;
		let remoteActorUri;

		before(async () => {
			// Create a local user with a different name so the webfinger handle
			// doesn't resolve to a local user via resolveLocalId
			localUid = await user.create({
				username: 'charlie_local',
				password: 'password123',
				email: 'charlie-local@example.com',
			});

			const { id, actor } = helpers.mocks.person({
				preferredUsername: 'charlie_remote',
				name: 'Charlie Remote',
			});
			remoteActorUri = id;
			await activitypub.actors.assert([remoteActorUri]);
		});

		it('should resolve exact webfinger to remote user', async () => {
			const hostname = new URL(remoteActorUri).hostname;
			const webfinger = `charlie_remote@${hostname}`;
			// Mock the webfinger query response so actors.qualify can resolve the handle to a URI
			activitypub.helpers._webfingerCache.set(webfinger, {
				actorUri: remoteActorUri,
				subject: `acct:charlie_remote@${hostname}`,
				username: 'charlie_remote',
				hostname,
			});

			const result = await user.search({
				query: webfinger,
				searchBy: 'username',
				uid: localUid,
			});

			assert.ok(result.users.length >= 1, 'should find the remote user');
			const hasRemote = result.users.some(u => u.uid === remoteActorUri);
			assert.ok(hasRemote, 'exact webfinger should resolve to remote user');
		});
	});

	describe('search by fullname', () => {
		let localUid;
		let remoteActorUri;

		before(async () => {
			localUid = await user.create({
				username: 'dave_search',
				password: 'password123',
				email: 'dave@example.com',
				fullname: 'Dave Local',
			});

			const { id } = helpers.mocks.person({
				preferredUsername: 'dave_remote',
				name: 'Dave Remote User',
			});
			remoteActorUri = id;
			await activitypub.actors.assert([remoteActorUri]);
		});

		it('should search both local fullname and remote name in parallel', async () => {
			const result = await user.search({
				query: 'dave',
				searchBy: 'fullname',
				uid: localUid,
			});

			assert.ok(result.users.length >= 2, `expected at least 2 users, got ${result.users.length}`);

			const hasLocal = result.users.some(u => u.username === 'dave_search');
			assert.ok(hasLocal, 'local user should be in results');

			const hasRemote = result.users.some(u => u.uid === remoteActorUri);
			assert.ok(hasRemote, 'remote user should be in results');
		});
	});
});
