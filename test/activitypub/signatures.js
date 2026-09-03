'use strict';

const assert = require('assert');
const nconf = require('nconf');
const { createHash } = require('crypto');
const { importPublicKey, getWebcrypto } = require('@misskey-dev/node-http-message-signatures');

const db = require('../mocks/databasemock');
const user = require('../../src/user');
const utils = require('../../src/utils');
const activitypub = require('../../src/activitypub');

describe('http signature signing and verification', () => {
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
			assert.strictEqual(digest, undefined);
		});

		it('should also return a digest hash if payload is passed in', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const payload = { foo: 'bar' };
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const hash = createHash('sha256');
			hash.update(JSON.stringify(payload));
			const checksum = `SHA-256=${hash.digest('base64')}`;
			const { digest } = await activitypub.sign(keyData, endpoint, checksum);

			assert(digest);
			assert.strictEqual(digest, checksum);
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
			assert.strictEqual(keyId, `keyId="${nconf.get('url')}/uid/${uid}#key"`);
		});

		it('should return the instance key id when uid is 0', async () => {
			const endpoint = `${nconf.get('url')}/uid/${uid}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', 0);
			const { signature } = await activitypub.sign(keyData, endpoint);
			const [keyId] = signature.split(',');

			assert(signature);
			assert.strictEqual(keyId, `keyId="${nconf.get('url')}/actor#key"`);
		});
	});

	describe('.verify()', () => {
		let uid;
		let username;
		const baseUrl = nconf.get('relative_path');
		const mockReqBase = {
			method: 'GET',
			// path: ...
			baseUrl,
			headers: {
				// host: ...
				// date: ...
				// signature: ...
				// digest: ...
			},
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
				...{
					url: path,
					path,
					headers: { ...signature, host },
				},
			};

			const verified = await activitypub.verify(req);
			assert.strictEqual(verified, true);
		});

		it('should return true when a digest is also passed in', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const path = `/user/${username}/inbox`;
			const payload = { foo: 'bar' };
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const hash = createHash('sha256');
			hash.update(JSON.stringify(payload));
			const checksum = `SHA-256=${hash.digest('base64')}`;
			const signature = await activitypub.sign(keyData, endpoint, checksum);
			const { host } = nconf.get('url_parsed');
			const req = {
				...mockReqBase,
				...{
					method: 'POST',
					url: path,
					path,
					body: payload,
					headers: { ...signature, host },
				},
			};

			const verified = await activitypub.verify(req);
			assert.strictEqual(verified, true);
		});

		it('should return true when a valid RFC 9421 signature is passed in', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const path = `/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { date, 'signature-input': signatureInput, signature } =
				await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			const { host } = nconf.get('url_parsed');
			const req = {
				...mockReqBase,
				...{
					url: path,
					path,
					headers: { date, 'signature-input': signatureInput, signature, host },
				},
			};

			const verified = await activitypub.verify(req);
			assert.strictEqual(verified, true);
		});

		it('should return true when an RFC 9421 signature with digest is passed in', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const path = `/user/${username}/inbox`;
			const payload = { foo: 'bar' };
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const hash = createHash('sha256');
			hash.update(JSON.stringify(payload));
			const checksum = `SHA-256=${hash.digest('base64')}`;
			const { date, digest, 'signature-input': signatureInput, signature } =
				await activitypub.signatures.signRfc9421(keyData, endpoint, 'POST', checksum);
			const { host } = nconf.get('url_parsed');
			const req = {
				...mockReqBase,
				...{
					method: 'POST',
					url: path,
					path,
					body: payload,
					headers: { date, digest, 'signature-input': signatureInput, signature, host },
				},
			};

			const verified = await activitypub.verify(req);
			assert.strictEqual(verified, true);
		});

		it('should return false when an RFC 9421 signature does not verify', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const path = `/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { date, 'signature-input': signatureInput, signature } =
				await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			const { host } = nconf.get('url_parsed');
			const req = {
				...mockReqBase,
				...{
					url: path,
					path,
					headers: {
						// Tamper with a covered component (date)
						date: 'Wed, 01 Jan 2020 00:00:00 GMT',
						'signature-input': signatureInput,
						signature,
						host,
					},
				},
			};

			const verified = await activitypub.verify(req);
			assert.strictEqual(verified, false);
		});
	});

	describe('.signRfc9421()', () => {
		let uid;
		const username = utils.generateUUID().slice(0, 10);

		before(async () => {
			uid = await user.create({ username });
		});

		it('should produce a structured-field byte sequence Signature header', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { signature } = await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			// RFC 8941/9651 byte sequence: ":" + base64 + ":"
			assert.match(signature, /^sig1=:[0-9A-Za-z+/]+={0,2}:$/);
		});

		it('should cover the @method and @target-uri components', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { 'signature-input': signatureInput } =
				await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			const componentIds = [...signatureInput.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
			assert(componentIds.includes('@method'));
			assert(componentIds.includes('@target-uri'));
		});

		it('should produce a signature that verifies against an independent signature base reconstruction', async () => {
			// Reconstructs the signature base by hand per RFC 9421 2.5 (matching
			// independent implementations such as Mitra) instead of trusting the
			// base factory on both sides
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { date, 'signature-input': signatureInput, signature } =
				await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			const { host } = nconf.get('url_parsed');

			const paramsMatch = signatureInput.match(/^sig1=(\([^)]*\));algorithm="([^"]*)";created=(\d+);keyid="([^"]*)"$/);
			assert(paramsMatch, `unexpected Signature-Input format: ${signatureInput}`);
			const [, componentsInnerList, algorithm, created, keyId] = paramsMatch;
			const componentIds = [...componentsInnerList.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
			const componentValues = {
				'@method': 'GET',
				'@target-uri': endpoint,
				host,
				date,
			};
			const lines = componentIds.map((id) => `"${id}": ${componentValues[id]}`);
			lines.push(`"@signature-params": ${componentsInnerList};algorithm="${algorithm}";created=${created};keyid="${keyId}"`);
			const expectedBase = lines.join('\n');

			const publicKeyPem = await activitypub.getPublicKey('uid', uid);
			const publicKey = await importPublicKey(publicKeyPem, ['verify']);
			const webcrypto = await getWebcrypto();
			const verified = await webcrypto.subtle.verify(
				{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
				publicKey,
				Buffer.from(signature.slice('sig1=:'.length, -1), 'base64'),
				new TextEncoder().encode(expectedBase),
			);
			assert.strictEqual(verified, true);
		});
	});

	describe('.getKeyId()', () => {
		it('should extract the keyId from a draft signature header', () => {
			const headers = {
				signature: 'keyId="https://example.org/user/test#key",algorithm="rsa-sha256",headers="(request-target) host date",signature="abc="',
			};
			assert.strictEqual(activitypub.signatures.getKeyId(headers), 'https://example.org/user/test#key');
		});

		it('should use the last keyId when a draft signature header contains duplicates', () => {
			const headers = {
				signature: 'keyId="https://example.org/a#key",keyId="https://example.org/b#key",signature="abc="',
			};
			assert.strictEqual(activitypub.signatures.getKeyId(headers), 'https://example.org/b#key');
		});

		it('should extract the keyid from an RFC 9421 Signature-Input header', () => {
			const headers = {
				'signature-input': 'sig1=("@request-target" "host" "date");created=1787933487;keyid="https://example.org/user/test#key"',
				signature: 'sig1="abc="',
			};
			assert.strictEqual(activitypub.signatures.getKeyId(headers), 'https://example.org/user/test#key');
		});

		it('should return null when no key identifier is present', () => {
			assert.strictEqual(activitypub.signatures.getKeyId({ signature: 'signature="abc="' }), null);
			assert.strictEqual(activitypub.signatures.getKeyId({}), null);
		});
	});

	describe('draft signatures with non-RSA keys', () => {
		it('should sign and verify a draft signature made with an EC key', async () => {
			const { generateKeyPairSync } = require('crypto');
			const kp = generateKeyPairSync('ec', { namedCurve: 'P-256' });
			const privPem = kp.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
			const pubPem = kp.publicKey.export({ format: 'pem', type: 'spki' }).toString();
			const keyId = 'https://example.org/ec-actor#key';
			const endpoint = `${nconf.get('url')}/uid/999/inbox`;
			const headers = await activitypub.signatures.sign({ key: privPem, keyId }, endpoint, 'GET');

			// The header must advertise an EC algorithm, not rsa-sha256
			assert(headers.signature.includes('algorithm="ecdsa-p256-sha256"'),
				`unexpected draft algorithm string: ${headers.signature}`);

			const req = {
				method: 'GET',
				url: '/uid/999/inbox',
				path: '/uid/999/inbox',
				headers: { ...headers, host: nconf.get('url_parsed').host },
			};

			const verified = await activitypub.signatures.verify(req, async () => pubPem);
			assert.strictEqual(verified, true);
		});
	});
});
