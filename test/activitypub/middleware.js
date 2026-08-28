'use strict';

const assert = require('assert');
const nconf = require('nconf');
const { createHash } = require('crypto');

const db = require('../mocks/databasemock');
const user = require('../../src/user');
const utils = require('../../src/utils');
const activitypub = require('../../src/activitypub');
const middleware = require('../../src/middleware/activitypub');

describe('middleware.verify', () => {
	let uid;
	let username;
	let keyData;
	let uid2;
	let username2;
	let keyData2;

	before(async () => {
		username = utils.generateUUID().slice(0, 10);
		uid = await user.create({ username });
		keyData = await activitypub.getPrivateKey('uid', uid);

		username2 = utils.generateUUID().slice(0, 10);
		uid2 = await user.create({ username: username2 });
		keyData2 = await activitypub.getPrivateKey('uid', uid2);
	});

	function buildReq(method, path, headers = {}) {
		const { host } = nconf.get('url_parsed');
		return {
			method,
			path,
			baseUrl: nconf.get('relative_path'),
			headers: {
				host,
				...headers,
			},
		};
	}

	function buildRes() {
		const res = {
			statusCode: null,
			sendStatus(code) {
				res.statusCode = code;
			},
		};
		return res;
	}

	async function runMiddleware(req, res) {
		let nextCalled = false;
		await middleware.verify(req, res, () => {
			nextCalled = true;
		});
		return { nextCalled, res };
	}

	async function getValidSignature(path, body = null) {
		const endpoint = `${nconf.get('url')}${path}`;
		let digest = null;
		if (body) {
			const hash = createHash('sha256');
			hash.update(JSON.stringify(body));
			digest = `SHA-256=${hash.digest('base64')}`;
		}
		return activitypub.sign(keyData, endpoint, digest);
	}

	describe('POST requests', () => {
		it('should call next() and set req.uid when signature is valid', async () => {
			const path = `/user/${username}/inbox`;
			const body = { foo: 'bar' };
			const signedHeaders = await getValidSignature(path, body);
			const req = buildReq('POST', path, signedHeaders);
			req.body = body;
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, true);
			assert.strictEqual(response.statusCode, null);
			assert.ok(req.uid);
		});

		it('should reject with 400 when signature is invalid', async () => {
			const path = `/user/${username}/inbox`;
			const req = buildReq('POST', path, {
				signature: 'keyId="invalid";algorithm="rsa-sha256";headers="(request-target) host date";signature="invalid"',
				date: new Date().toUTCString(),
			});
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, false);
			assert.strictEqual(response.statusCode, 400);
		});

		it('should reject with 401 when no signature is present', async () => {
			const path = `/user/${username}/inbox`;
			const req = buildReq('POST', path, {});
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, false);
			assert.strictEqual(response.statusCode, 401);
		});
	});

	describe('GET requests', () => {
		it('should call next() and set req.uid when signature is valid', async () => {
			const path = `/user/${username}/inbox`;
			const signedHeaders = await getValidSignature(path);
			const req = buildReq('GET', path, signedHeaders);
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, true);
			assert.strictEqual(response.statusCode, null);
			assert.ok(req.uid);
		});

		it('should call next() without setting req.uid when signature is invalid (treat as anonymous)', async () => {
			const path = `/user/${username}/inbox`;
			const req = buildReq('GET', path, {
				signature: 'keyId="invalid";algorithm="rsa-sha256";headers="(request-target) host date";signature="invalid"',
				date: new Date().toUTCString(),
			});
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, true);
			assert.strictEqual(response.statusCode, null);
			assert.strictEqual(req.uid, undefined);
		});

		it('should call next() when no signature is present', async () => {
			const path = `/user/${username}/inbox`;
			const req = buildReq('GET', path, {});
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, true);
			assert.strictEqual(response.statusCode, null);
		});
	});

	describe('passthrough paths', () => {
		it('should skip verification for GET /actor', async () => {
			const req = buildReq('GET', '/actor', {});
			const res = buildRes();
			const { nextCalled } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, true);
		});
	});

	describe('duplicate keyId parameters', () => {
		it('should use the last keyId for req.uid to match verification keyId', async () => {
			// Regression test: when a signature header contains duplicate keyId parameters,
			// the middleware must use the same keyId that the library used for verification
			// (last-wins), not the first occurrence (first-wins).
			// See: https://github.com/nodebb/NodeBB/issues/...
			const path = `/user/${username}/inbox`;
			const signedHeaders = await getValidSignature(path);

			// Construct a signature header with a spoofed keyId first, then the real one last.
			// The real keyId matches what was used to sign (uid).
			// The spoofed keyId references uid2 (a different user).
			const realKeyId = `keyId="${nconf.get('url')}/uid/${uid}#key"`;
			const spoofedKeyId = `keyId="${nconf.get('url')}/uid/${uid2}#key"`;
			const dupeSignature = `${spoofedKeyId},${realKeyId},${signedHeaders.signature.split(',').slice(1).join(',')}`;

			const req = buildReq('GET', path, {
				signature: dupeSignature,
				date: signedHeaders.date,
			});
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, true);
			assert.strictEqual(response.statusCode, null);
			// req.uid should be set to the LAST keyId (uid), matching the keyId used for verification.
			// The middleware strips the keyId= prefix and trailing quote, then removes the fragment.
			const expectedUid = `${nconf.get('url')}/uid/${uid}`;
			assert.strictEqual(req.uid, expectedUid);
			assert.notStrictEqual(req.uid, `${nconf.get('url')}/uid/${uid2}`);
		});
	});

	describe('keyId with leading whitespace (algorithm before keyId)', () => {
		it('should extract req.uid even when keyId is preceded by whitespace', async () => {
			// Regression test: when algorithm precedes keyId in the signature header,
			// the library trims the leading space before keyId, but the middleware's
			// naive split(',') does not. Both code paths must trim to stay in sync.
			const path = `/user/${username}/inbox`;
			const signedHeaders = await getValidSignature(path);

			// Reorder: algorithm before keyId introduces whitespace before keyId.
			// The library trims it; the middleware must too.
			const parts = signedHeaders.signature.split(',');
			const algorithmPart = parts.find(p => p.startsWith('algorithm='));
			const signaturePart = parts.find(p => p.startsWith('signature='));
			const headersPart = parts.find(p => p.startsWith('headers='));
			const reordered = `${algorithmPart}, keyId="${nconf.get('url')}/uid/${uid}#key", ${headersPart}, ${signaturePart}`;

			const req = buildReq('GET', path, {
				signature: reordered,
				date: signedHeaders.date,
			});
			const res = buildRes();
			const { nextCalled, res: response } = await runMiddleware(req, res);

			assert.strictEqual(nextCalled, true);
			assert.strictEqual(response.statusCode, null);
			const expectedUid = `${nconf.get('url')}/uid/${uid}`;
			assert.strictEqual(req.uid, expectedUid);
		});
	});
});

describe('middleware.assertPayload', () => {
	let uid;
	let username;
	let keyData;
	let path;

	before(async () => {
		username = utils.generateUUID().slice(0, 10);
		uid = await user.create({ username });
		keyData = await activitypub.getPrivateKey('uid', uid);
		path = `/user/${username}/inbox`;
	});

	function buildReqWithSignature(method, path, headers = {}) {
		const { host } = nconf.get('url_parsed');
		return {
			method,
			path,
			baseUrl: nconf.get('relative_path'),
			headers: { host, ...headers },
		};
	}

	function buildRes() {
		const res = { statusCode: null };
		res.sendStatus = (code) => { res.statusCode = code; };
		return res;
	}

	async function runPayloadMiddleware(req, body) {
		const res = buildRes();
		let nextCalled = false;
		req.body = body;
		await middleware.assertPayload(req, res, () => { nextCalled = true; });
		return { nextCalled, res };
	}

	it('should extract keyId from signature header with leading whitespace', async () => {
		// Regression test: assertPayload's Map-based keyId parsing must trim
		// whitespace from parameter names to match the library's behavior.
		const signedHeaders = await activitypub.sign(keyData, `${nconf.get('url')}${path}`, null);

		// Reorder so algorithm precedes keyId, introducing whitespace before keyId.
		const parts = signedHeaders.signature.split(',');
		const algorithmPart = parts.find(p => p.startsWith('algorithm='));
		const signaturePart = parts.find(p => p.startsWith('signature='));
		const headersPart = parts.find(p => p.startsWith('headers='));
		const reordered = `${algorithmPart}, keyId="${nconf.get('url')}/uid/${uid}#key", ${headersPart}, ${signaturePart}`;

		const req = buildReqWithSignature('POST', path, { signature: reordered, date: signedHeaders.date });
		const body = {
			id: `https://example.org/activity/${utils.generateUUID()}`,
			type: 'Create',
			actor: `${nconf.get('url')}/uid/${uid}`,
			object: { type: 'Note', id: `${nconf.get('url')}/topic/1` },
		};
		const res = buildRes();
		const { nextCalled, res: response } = await runPayloadMiddleware(req, body);

		// The actor (local uid) has no stored keys in the remote AP DB, so
		// compare is ''. After the fix, keyId is correctly parsed as the
		// actual keyId URL. '' !== keyId → cross-check fails → 403.
		// Before the fix, both were '' → cross-check passed → next() called.
		assert.strictEqual(nextCalled, false);
		assert.strictEqual(response.statusCode, 403);
	});
});
