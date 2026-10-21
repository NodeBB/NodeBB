'use strict';

const assert = require('assert');
const nconf = require('nconf');
const { createHash, generateKeyPairSync, sign } = require('crypto');

const signatures = require('../../src/activitypub/signatures');

describe('Content-Digest verification', () => {
	const rawBody = '{\n  "foo": "bar"\n}';
	const digest = createHash('sha256').update(rawBody).digest('base64');
	const keyId = 'https://example.org/actor#key';
	let privateKey;
	let publicKey;

	before(() => {
		({ privateKey, publicKey } = generateKeyPairSync('rsa', {
			modulusLength: 2048,
			privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
			publicKeyEncoding: { type: 'spki', format: 'pem' },
		}));
	});

	function createRequest(contentDigest) {
		const path = `${nconf.get('relative_path') || ''}/uid/1/inbox`;
		const endpoint = `https://example.org${path}`;
		const headers = {
			host: 'example.org',
			date: new Date().toUTCString(),
			'content-type': 'application/activity+json',
			'content-digest': contentDigest,
		};
		const components = ['@method', '@authority', '@target-uri', 'content-digest', 'content-type', 'date'];
		const params = `("${components.join('" "')}");keyid="${keyId}";alg="rsa-v1_5-sha256";created=${Math.floor(Date.now() / 1000)}`;
		const values = { ...headers, '@method': 'POST', '@authority': headers.host, '@target-uri': endpoint };
		// Sign the header exactly as sent, independently of NodeBB's signing helper.
		const signatureBase = components.map(name => `"${name}": ${values[name]}`)
			.concat(`"@signature-params": ${params}`).join('\n');
		headers['signature-input'] = `sig1=${params}`;
		headers.signature = `sig1=:${sign('sha256', Buffer.from(signatureBase), privateKey).toString('base64')}:`;
		return { method: 'POST', protocol: 'https', url: path, headers, rawBody, body: JSON.parse(rawBody) };
	}

	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	const nonZeroPadBits = digest.slice(0, -2) + alphabet[alphabet.indexOf(digest.at(-2)) + 1] + '=';
	const validDigests = [
		['canonical padding', digest],
		['missing padding', digest.slice(0, -1)],
		['extra padding', `${digest}=`],
		['non-zero pad bits', nonZeroPadBits],
	];
	validDigests.forEach(([description, encoded]) => {
		it(`should verify a signed Content-Digest with ${description}`, async () => {
			const req = createRequest(`sha-256=:${encoded}:`);
			assert.strictEqual(await signatures.verify(req, async () => publicKey), keyId);
		});
	});

	const invalidDigests = [
		['a different body', `sha-256=:${createHash('sha256').update('other body').digest('base64')}:`],
		['a truncated digest', `sha-256=:${Buffer.from(digest, 'base64').subarray(0, 31).toString('base64')}:`],
		['an overlong digest', `sha-256=:${Buffer.concat([Buffer.from(digest, 'base64'), Buffer.from([0])]).toString('base64')}:`],
		['an invalid character', `sha-256=:!${digest}:`],
		['a URL-safe alphabet character', `sha-256=:${digest.replace(/\+/g, '-')}:`],
		['embedded whitespace', `sha-256=:${digest.slice(0, 10)} ${digest.slice(10)}:`],
		['a line feed', `sha-256=:${digest.slice(0, 10)}\n${digest.slice(10)}:`],
		['a trailing line feed', `sha-256=:${digest}:\n`],
		['embedded padding', `sha-256=:${digest.slice(0, 10)}=${digest.slice(10)}:`],
		['a missing closing colon', `sha-256=:${digest}=`],
	];
	invalidDigests.forEach(([description, contentDigest]) => {
		it(`should reject a signed Content-Digest with ${description}`, async () => {
			const req = createRequest(contentDigest);
			let fetchedKey = false;
			const verified = await signatures.verify(req, async () => {
				fetchedKey = true;
				return publicKey;
			});
			assert.strictEqual(verified, false);
			assert.strictEqual(fetchedKey, false);
		});
	});

	it('should reject a modified raw body even when the signature is valid', async () => {
		const req = createRequest(`sha-256=:${digest}:`);
		req.rawBody = JSON.stringify(req.body);
		assert.strictEqual(await signatures.verify(req, async () => publicKey), false);
	});

	it('should reject a header changed after signing even if it decodes to the same digest', async () => {
		const req = createRequest(`sha-256=:${digest}:`);
		req.headers['content-digest'] = `sha-256=:${digest.slice(0, -1)}:`;
		assert.strictEqual(await signatures.verify(req, async () => publicKey), false);
	});
});
