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

	before(async () => {
		username = utils.generateUUID().slice(0, 10);
		uid = await user.create({ username });
		keyData = await activitypub.getPrivateKey('uid', uid);
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
});
