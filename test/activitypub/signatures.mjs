import assert from 'assert';
import nconf from 'nconf';
import { createHash } from 'crypto';

import db from '../mocks/databasemock.mjs';
import user from '../../src/user/index.js';
import utils from '../../src/utils.js';
import activitypub from '../../src/activitypub/index.js';

describe('ActivityPub/HTTP Signature', () => {
	describe('.sign()', () => {
		let uid;

		before(async () => {
			uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
		});

		it('should create a key-pair for a user if the user does not have one already', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			await activitypub.sign(keyData, endpoint);
			const { publicKey, privateKey } = await db.getObject(`uid:${uid}:keys`);

			assert(publicKey);
			assert(privateKey);
		});

		it('should return an object with date, a null digest, and signature, if no payload is passed in', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { date, digest, signature } = await activitypub.sign(keyData, endpoint);
			const dateObj = new Date(date);

			assert(signature);
			assert(dateObj);
			assert.strict.strictEqual(digest, null);
		});

		it('should also return a digest hash if payload is passed in', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const payload = { foo: 'bar' };
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { digest } = await activitypub.sign(keyData, endpoint, payload);
			const hash = createHash('sha256');
			hash.update(JSON.stringify(payload));
			const checksum = hash.digest('base64');

			assert(digest);
			assert.strict.strictEqual(digest, `SHA-256=${checksum}`);
		});

		it('should create a key for NodeBB itself if a uid of 0 is passed in', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', 0);
			await activitypub.sign(keyData, endpoint);
			const { publicKey, privateKey } = await db.getObject(`uid:0:keys`);

			assert(publicKey);
			assert(privateKey);
		});

		it('should return headers with an appropriate key id uri', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { signature } = await activitypub.sign(keyData, endpoint);
			const [keyId] = signature.split(',');

			assert(signature);
			assert.strict.strictEqual(keyId, `keyId="${nconf.get('url')}/uid/${uid}#key"`);
		});

		it('should return the instance key id when uid is 0', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', 0);
			const { signature } = await activitypub.sign(keyData, endpoint);
			const [keyId] = signature.split(',');

			assert(signature);
			assert.strict.strictEqual(keyId, `keyId="${nconf.get('url')}/actor#key"`);
		});
	});

	describe('.verify()', () => {
		let uid;
		let username;
		const baseUrl = nconf.get('relative_path');
		const mockReqBase = {
			method: 'GET',
			baseUrl,
			headers: {},
		};

		before(async () => {
			username = utils.generateUUID().slice(0, 10);
			uid = await user.create({ username });
		});

		it('should return true when the proper signature and relevant headers are passed in', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const path = `/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const signature = await activitypub.sign(keyData, endpoint);
			const { host } = nconf.get('url_parsed');
			const req = {
				...mockReqBase,
				path,
				headers: { ...signature, host },
			};

			const verified = await activitypub.verify(req);
			assert.strict.strictEqual(verified, true);
		});

		it('should return true when a digest is also passed in', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const path = `/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const signature = await activitypub.sign(keyData, endpoint, { foo: 'bar' });
			const { host } = nconf.get('url_parsed');
			const req = {
				...mockReqBase,
				method: 'POST',
				path,
				headers: { ...signature, host },
			};

			const verified = await activitypub.verify(req);
			assert.strict.strictEqual(verified, true);
		});
	});
});