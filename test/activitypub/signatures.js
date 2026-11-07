'use strict';

const assert = require('assert');
const nconf = require('nconf');
const { createHash, generateKeyPairSync } = require('crypto');
const { importPublicKey, getWebcrypto } = require('@misskey-dev/node-http-message-signatures');

const db = require('../mocks/databasemock');
const meta = require('../../src/meta');
const user = require('../../src/user');
const utils = require('../../src/utils');
const request = require('../../src/request');
const helpers = require('../activitypub/helpers');
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
			assert.strictEqual(verified, `${nconf.get('url')}/uid/${uid}#key`);
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
			assert.strictEqual(verified, `${nconf.get('url')}/uid/${uid}#key`);
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
			assert.strictEqual(verified, `${nconf.get('url')}/uid/${uid}#key`);
		});

		it('should return true when an RFC 9421 signature with content digest is passed in', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const path = `/user/${username}/inbox`;
			const payload = { foo: 'bar' };
			const body = JSON.stringify(payload);
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const hash = createHash('sha256');
			hash.update(body);
			const expectedContentDigest = `sha-256=:${hash.digest('base64')}:`;
			const {
				date,
				'content-digest': contentDigest,
				'content-type': contentType,
				'signature-input': signatureInput,
				signature,
			} = await activitypub.signatures.signRfc9421(keyData, endpoint, 'POST', body);
			assert.strictEqual(contentDigest, expectedContentDigest);
			assert.strictEqual(contentType, 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"');
			const { host } = nconf.get('url_parsed');
			const req = {
				...mockReqBase,
				...{
					method: 'POST',
					url: path,
					path,
					body: payload,
					headers: {
						date,
						'content-digest': contentDigest,
						'content-type': contentType,
						'signature-input': signatureInput,
						signature,
						host,
					},
				},
			};

			const verified = await activitypub.verify(req);
			assert.strictEqual(verified, `${nconf.get('url')}/uid/${uid}#key`);
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

		it('should produce an activitypub structured-field byte sequence Signature header', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { signature } = await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			// RFC 8941/9651 byte sequence: ":" + base64 + ":"
			assert.match(signature, /^activitypub=:[0-9A-Za-z+/]+={0,2}:$/);
		});

		it('should cover the strict ActivityPub GET components', async () => {
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { 'signature-input': signatureInput } =
				await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			const componentIds = [...signatureInput.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
			assert.deepStrictEqual(componentIds.slice(0, 4), [
				'@method',
				'@authority',
				'@target-uri',
				'date',
			]);
			assert(signatureInput.includes('tag="activitypub"'));
			assert(signatureInput.includes('alg="rsa-v1_5-sha256"'));
			assert(/;nonce="[^"]+";created=\d+$/.test(signatureInput));
		});

		it('should produce a strict ActivityPub signature that verifies against an independent signature base reconstruction', async () => {
			// Reconstruct the signature base by hand instead of trusting the same
			// RFC9421SignatureBaseFactory on both sides of the test.
			const endpoint = `${nconf.get('url')}/user/${username}/inbox`;
			const keyData = await activitypub.getPrivateKey('uid', uid);
			const { date, 'signature-input': signatureInput, signature } =
				await activitypub.signatures.signRfc9421(keyData, endpoint, 'GET');
			const { host } = nconf.get('url_parsed');

			const paramsMatch = signatureInput.match(
				/^activitypub=(\([^)]*\));keyid="([^"]*)";alg="([^"]*)";tag="activitypub";nonce="([^"]+)";created=(\d+)$/
			);
			assert(paramsMatch, `unexpected Signature-Input format: ${signatureInput}`);
			const [, componentsInnerList, keyId, algorithm, nonce, created] = paramsMatch;
			const componentIds = [...componentsInnerList.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
			assert.deepStrictEqual(componentIds, ['@method', '@authority', '@target-uri', 'date']);
			assert.strictEqual(algorithm, 'rsa-v1_5-sha256');
			const componentValues = {
				'@method': 'GET',
				'@authority': host,
				'@target-uri': endpoint,
				date,
			};
			const lines = componentIds.map((id) => `"${id}": ${componentValues[id]}`);
			lines.push(
				`"@signature-params": ${componentsInnerList};keyid="${keyId}";alg="${algorithm}";tag="activitypub";nonce="${nonce}";created=${created}`
			);
			const expectedBase = lines.join('\n');

			const publicKeyPem = await activitypub.getPublicKey('uid', uid);
			const publicKey = await importPublicKey(publicKeyPem, ['verify']);
			const webcrypto = await getWebcrypto();
			const verified = await webcrypto.subtle.verify(
				{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
				publicKey,
				Buffer.from(signature.slice('activitypub=:'.length, -1), 'base64'),
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
			assert(headers.signature.includes('algorithm="ecdsa-sha256"'),
				`unexpected draft algorithm string: ${headers.signature}`);

			const req = {
				method: 'GET',
				url: '/uid/999/inbox',
				path: '/uid/999/inbox',
				headers: { ...headers, host: nconf.get('url_parsed').host },
			};

			const verified = await activitypub.signatures.verify(req, async () => pubPem);
			assert.strictEqual(verified, 'https://example.org/ec-actor#key');
		});
	});

	describe('keyId parser mismatch (regression)', () => {
		it('should return the verified keyId, not a value a naive re-parse extracts from a crafted header', async () => {
			const { generateKeyPairSync } = require('crypto');
			const {
				genDraftSigningString, genDraftSignature, importPrivateKey,
			} = require('@misskey-dev/node-http-message-signatures');

			const attacker = generateKeyPairSync('ec', { namedCurve: 'P-256' });
			const attackerPrivPem = attacker.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
			const attackerPubPem = attacker.publicKey.export({ format: 'pem', type: 'spki' }).toString();
			const attackerKeyId = 'https://attacker.example/actor#main-key';
			const victimKeyId = 'https://victim.example/actor#main-key';

			const endpoint = `${nconf.get('url')}/uid/1/inbox`;
			const url = new URL(endpoint);
			const date = new Date().toUTCString();
			const reqHeaders = { date, host: nconf.get('url_parsed').host };
			const includeHeaders = ['(request-target)', 'host', 'date'];
			const ALGO = 'ecdsa-sha256';

			// The attacker signs with THEIR key; the signing string uses the attacker keyId.
			const signingString = genDraftSigningString(
				{ method: 'GET', url: url.href, headers: reqHeaders },
				includeHeaders,
				{ keyId: attackerKeyId, algorithm: ALGO }
			);
			const privateKey = await importPrivateKey(attackerPrivPem, ['sign']);
			const SIG = await genDraftSignature(privateKey, signingString);

			// A crafted header whose quoted `foo` value contains a comma: a naive
			// split(',')-based parser reports the VICTIM keyId (the comma-split tail
			// that looks like a standalone keyId="..." param), while the spec-aware
			// parser used for verification reports the ATTACKER keyId.
			const header = `keyId="${attackerKeyId}",algorithm="${ALGO}",headers="${includeHeaders.join(' ')}",signature="${SIG}",foo="x,keyId="${victimKeyId}"`;

			// Precondition: the two parsers actually disagree on this header.
			assert.strictEqual(activitypub.signatures.getKeyId({ signature: header }), victimKeyId);

			// The verified keyId MUST be the attacker's (the key that actually signed),
			// so downstream identity (req.uid) cannot be spoofed to the victim.
			const verified = await activitypub.signatures.verify(
				{
					method: 'GET',
					url: '/uid/1/inbox',
					path: '/uid/1/inbox',
					headers: { ...reqHeaders, signature: header },
				},
				async (keyId) => (keyId === attackerKeyId ? attackerPubPem : null)
			);
			assert.strictEqual(verified, attackerKeyId);
		});
	});

	describe('.fetchPublicKey()', () => {
		let uid;
		let privPem;
		let pubPem;
		let pubPem2;
		let originalGet;

		before(async () => {
			uid = await user.create({ username: utils.generateUUID().slice(0, 10) });
			const kp = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
			privPem = kp.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
			pubPem = kp.publicKey.export({ format: 'pem', type: 'spki' }).toString();
			const kp2 = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
			pubPem2 = kp2.publicKey.export({ format: 'pem', type: 'spki' }).toString();
			originalGet = request.get;
		});

		after(() => {
			request.get = originalGet;
			helpers.mocks.restoreRequests();
		});

		// Stands in for a remote server. The returned array records the headers of
		// every request NodeBB makes, so tests can assert what the key fetch looked like.
		const stubServer = (respond) => {
			const seen = [];
			request.get = async (url, config) => {
				const headers = (config && config.headers) || {};
				seen.push({ url, headers });
				return respond(url, headers);
			};
			return seen;
		};

		const actorDocument = (url, pem) => ({
			body: {
				'@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
				id: url,
				type: 'Person',
				publicKey: { id: `${url}#main-key`, owner: url, publicKeyPem: pem },
			},
			response: { ok: true, status: 200, statusCode: 200, statusText: 'OK', headers: { 'content-type': 'application/activity+json' } },
			url,
		});

		// Mastodon in AUTHORIZED_FETCH=true mode answers unsigned actor requests thus
		const unsignedRejected = (url) => ({
			body: { error: 'Request not signed' },
			response: { ok: false, status: 401, statusCode: 401, statusText: 'Unauthorized', headers: { 'content-type': 'application/json' } },
			url,
		});

		// A server that serves the key document only to signed requests
		const serveSignedOnly = (url, headers) => (headers.signature ?
			actorDocument(url, pubPem) :
			unsignedRejected(url));

		// A server that cannot look up NodeBB's instance key: it refuses the signed
		// request, and serves the key document to unsigned ones
		const refuseSignedOnly = (url, headers) => (headers.signature ?
			unsignedRejected(url) :
			actorDocument(url, pubPem));

		// Unique URIs, so the public key cache is not shared between tests
		const keyUri = () => `https://example.org/users/${utils.generateUUID().slice(0, 8)}#main-key`;

		it('should resolve NodeBB\'s own key id from the database, without an HTTP request', async () => {
			const storedPem = await activitypub.getPublicKey('uid', uid);
			const seen = stubServer(() => {
				throw new Error('local keys must not be fetched over HTTP');
			});

			assert.strictEqual(await activitypub.fetchPublicKey(`${nconf.get('url')}/uid/${uid}#key`, '203.0.113.7'), storedPem);
			assert.strictEqual(seen.length, 0);
		});

		it('should resolve the instance actor key id (/actor#key) locally', async () => {
			const storedPem = await activitypub.getPublicKey('uid', 0);
			const seen = stubServer(() => {
				throw new Error('local keys must not be fetched over HTTP');
			});

			assert.strictEqual(await activitypub.fetchPublicKey(`${nconf.get('url')}/actor#key`, '203.0.113.7'), storedPem);
			assert.strictEqual(seen.length, 0);
		});

		it('should not read a user key hash for a post URI whose id collides with a uid', async () => {
			// resolveLocalId reports `https://site/post/N` as { type: 'post', id: 'N' };
			// reading `uid:N:keys` for it would return user N's key.
			const uidPem = await activitypub.getPublicKey('uid', uid);
			const seen = stubServer(url => actorDocument(url, pubPem2));

			const pem = await activitypub.fetchPublicKey(`${nconf.get('url')}/post/${uid}#key`, '203.0.113.7');
			assert.notStrictEqual(pem, uidPem);
			assert.strictEqual(pem, pubPem2);
			assert.strictEqual(seen.length, 1);
		});

		it('should sign the outgoing key fetch when key data is passed in', async () => {
			const uri = keyUri();
			const seen = stubServer(url => actorDocument(url, pubPem));

			const pem = await activitypub.fetchPublicKey(uri, '203.0.113.7', await activitypub.getPrivateKey('uid', 0));
			assert.strictEqual(pem, pubPem);
			assert.strictEqual(seen.length, 1);
			assert(seen[0].headers.signature, 'the key fetch was not signed');
			assert(seen[0].headers.signature.includes(`keyId="${nconf.get('url')}/actor#key"`),
				`the key fetch must be signed with the instance actor key: ${seen[0].headers.signature}`);
		});

		it('should fetch unsigned when no key data is passed in', async () => {
			const uri = keyUri();
			const seen = stubServer(url => actorDocument(url, pubPem));

			await activitypub.fetchPublicKey(uri, '203.0.113.7');
			assert.strictEqual(seen.length, 1);
			assert.strictEqual(seen[0].headers.signature, undefined);
		});

		it('should fetch keys from servers that require signed GETs (authorized fetch)', async () => {
			const uri = keyUri();
			const seen = stubServer(serveSignedOnly);

			const pem = await activitypub.fetchPublicKey(uri, '203.0.113.7', await activitypub.getPrivateKey('uid', 0));
			assert.strictEqual(pem, pubPem);
			assert.strictEqual(seen.length, 1, 'the signed fetch should have succeeded on the first attempt');
		});

		it('should fall back to an unsigned fetch when the signed request is refused', async () => {
			const uri = keyUri();
			const seen = stubServer(refuseSignedOnly);

			const pem = await activitypub.fetchPublicKey(uri, '203.0.113.7', await activitypub.getPrivateKey('uid', 0));
			assert.strictEqual(pem, pubPem);
			assert.strictEqual(seen.length, 2, 'the unsigned fallback should have run');
		});

		it('should throw when the key cannot be fetched, and cache the failure', async () => {
			const uri = keyUri();
			const seen = stubServer(url => unsignedRejected(url));
			const keyData = await activitypub.getPrivateKey('uid', 0);

			await assert.rejects(activitypub.fetchPublicKey(uri, '203.0.113.7', keyData), /pubKey-not-found/);
			assert.strictEqual(seen.length, 2);

			// the cached failure short-circuits later lookups
			await assert.rejects(activitypub.fetchPublicKey(uri, '203.0.113.7', keyData), /pubKey-not-found/);
			assert.strictEqual(seen.length, 2);
		});

		it('should use the stored key of an asserted remote actor, without an HTTP request', async () => {
			const actorId = `https://example.org/users/${utils.generateUUID().slice(0, 8)}`;
			helpers.mocks.mockRequests();
			helpers.mocks.person({
				id: actorId,
				preferredUsername: `key${utils.generateUUID().slice(0, 6)}`,
				publicKey: { id: `${actorId}#main-key`, owner: actorId, publicKeyPem: pubPem },
			});
			await activitypub.actors.assert(actorId, { update: true });

			const seen = stubServer(() => {
				throw new Error('known keys must not be fetched over HTTP');
			});
			assert.strictEqual(await activitypub.fetchPublicKey(`${actorId}#main-key`, '203.0.113.7'), pubPem);
			assert.strictEqual(seen.length, 0);

			helpers.mocks.restoreRequests();
		});

		it('should verify a delivery from a secure-mode server (issue #14988)', async () => {
			const keyId = keyUri();
			const path = '/category/5/inbox';
			const endpoint = `${nconf.get('url')}${path}`;
			const body = {
				id: 'https://example.org/activities/1',
				type: 'Follow',
				actor: keyId.replace(/#.*$/, ''),
				object: `${nconf.get('url')}/category/5`,
			};
			const digest = activitypub.signatures.calculateDigest(JSON.stringify(body));
			const signedHeaders = await activitypub.signatures.sign({ key: privPem, keyId }, endpoint, 'POST', digest);
			const seen = stubServer(serveSignedOnly);
			const { activitypubEnabled } = meta.config;
			meta.config.activitypubEnabled = 1;

			const req = {
				method: 'POST',
				url: path,
				path,
				ip: '203.0.113.7',
				rawBody: Buffer.from(JSON.stringify(body)),
				body,
				headers: {
					host: nconf.get('url_parsed').host,
					'content-type': 'application/activity+json',
					digest,
					...signedHeaders,
				},
			};

			const verified = await activitypub.verify(req);
			meta.config.activitypubEnabled = activitypubEnabled;

			assert.strictEqual(verified, keyId, 'a delivery from an authorized-fetch server must verify');
			assert(seen[0].headers.signature, 'the key fetch must be signed');
		});
	});
});
