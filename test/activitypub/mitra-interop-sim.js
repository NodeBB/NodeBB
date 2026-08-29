'use strict';

// Simulates an incoming RFC 9421 request EXACTLY as Mitra builds it
// (see apx_core/src/http_signatures/create.rs) and runs it through
// NodeBB's real verification path.

const assert = require('assert');
const { createHash, generateKeyPairSync, webcrypto } = require('crypto');

require('../mocks/databasemock');
const nconf = require('nconf');
const signatures = require('../../src/activitypub/signatures');

describe('Mitra-style incoming RFC 9421 request (interop simulation)', () => {
	let kp;
	let pubPem;
	let signingKey;

	before(async () => {
		kp = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
		pubPem = kp.publicKey.export({ format: 'pem', type: 'spki' }).toString();
		// This Node build requires importKey with DER (KeyObject not accepted by subtle.sign)
		signingKey = await webcrypto.subtle.importKey(
			'pkcs8',
			kp.privateKey.export({ format: 'der', type: 'pkcs8' }),
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			false,
			['sign'],
		);
	});

	it('should verify a request built exactly like Mitra builds it', async () => {
		const url = `${nconf.get('url')}/uid/1/inbox`;
		const body = JSON.stringify({
			id: 'https://mitra.example/activities/123',
			type: 'Announce',
			actor: 'https://mitra.example/users/alice',
			object: 'https://mitra.example/statuses/abc',
		});
		const bodyBuf = Buffer.from(body, 'utf8');

		// Content-Digest: sha-256=:<b64>:  (RFC 9530 style, create_content_digest_header)
		const digestB64 = createHash('sha256').update(bodyBuf).digest('base64');
		const contentDigest = `sha-256=:${digestB64}=`;

		const keyId = 'https://mitra.example/users/alice#main-key';
		const created = Math.floor(Date.now() / 1000);
		const alg = 'rsa-v1_5-sha256';

		// Signature-Input: sig1=("@method" "@target-uri" "content-digest");keyid="...";created=N;alg="..."
		// (sfv IndexMap insertion order: keyid, created, alg)
		const signatureInput = `sig1=("@method" "@target-uri" "content-digest");keyid="${keyId}";created=${created};alg="${alg}"`;

		// Signature base (create_http_signature_rfc9421):
		const base = [
			'"@method": POST',
			`"@target-uri": ${url}`,
			`"content-digest": ${contentDigest}`,
			`"@signature-params": ("@method" "@target-uri" "content-digest");keyid="${keyId}";created=${created};alg="${alg}"`,
		].join('\n');

		const sig = await webcrypto.subtle.sign(
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			signingKey,
			new TextEncoder().encode(base),
		);
		const sigB64 = Buffer.from(sig).toString('base64');

		// Mitra sends: Content-Digest, Signature, Signature-Input (reqwest adds Host)
		const req = {
			method: 'POST',
			originalUrl: '/uid/1/inbox',
			url: '/uid/1/inbox',
			ip: '203.0.113.7',
			rawBody: bodyBuf,
			body: JSON.parse(body),
			headers: {
				'content-type': 'application/activity+json',
				// Real requests always have a Host header matching the dialed URL
				host: nconf.get('url_parsed').host,
				'content-digest': contentDigest,
				'signature-input': signatureInput,
				signature: `sig1=:${sigB64}:`,
			},
		};

		const fetchPublicKeyFn = async (uri) => {
			assert.strictEqual(uri, keyId);
			return pubPem;
		};

		const verified = await signatures.verify(req, fetchPublicKeyFn);
		assert.strictEqual(verified, true, 'NodeBB failed to verify a Mitra-style RFC 9421 request');
	});

	it('should verify a Mitra-style request whose created param is 4 minutes old (within clock skew)', async () => {
		const url = `${nconf.get('url')}/uid/1/inbox`;
		const body = JSON.stringify({ id: 'https://mitra.example/activities/124', type: 'Announce', actor: 'https://mitra.example/users/alice', object: 'https://mitra.example/statuses/abc' });
		const bodyBuf = Buffer.from(body, 'utf8');
		const digestB64 = createHash('sha256').update(bodyBuf).digest('base64');
		const contentDigest = `sha-256=:${digestB64}=`;

		const keyId = 'https://mitra.example/users/alice#main-key';
		const created = Math.floor(Date.now() / 1000) - 240; // 4 minutes ago
		const alg = 'rsa-v1_5-sha256';
		const signatureInput = `sig1=("@method" "@target-uri" "content-digest");keyid="${keyId}";created=${created};alg="${alg}"`;
		const base = [
			'"@method": POST',
			`"@target-uri": ${url}`,
			`"content-digest": ${contentDigest}`,
			`"@signature-params": ("@method" "@target-uri" "content-digest");keyid="${keyId}";created=${created};alg="${alg}"`,
		].join('\n');
		const sig = await webcrypto.subtle.sign(
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			signingKey,
			new TextEncoder().encode(base),
		);
		const req = {
			method: 'POST',
			originalUrl: '/uid/1/inbox',
			url: '/uid/1/inbox',
			ip: '203.0.113.7',
			rawBody: bodyBuf,
			body: JSON.parse(body),
			headers: {
				'content-type': 'application/activity+json',
				host: nconf.get('url_parsed').host,
				'content-digest': contentDigest,
				'signature-input': signatureInput,
				signature: `sig1=:${Buffer.from(sig).toString('base64')}:`,
			},
		};

		const verified = await signatures.verify(req, async () => pubPem);
		assert.strictEqual(verified, true);
	});

	it('should verify when the signed @target-uri host differs from the configured URL (host mismatch)', async () => {
		// Mitra signs the URL it dialed. If that differs from NodeBB's configured
		// origin (reverse proxy, port, www vs. non-www, IP vs. domain), the
		// target URI is reconstructed from the Host header instead
		const dialedUrl = 'https://nodebb.example/uid/1/inbox';
		const body = JSON.stringify({ id: 'https://mitra.example/activities/125', type: 'Announce', actor: 'https://mitra.example/users/alice', object: 'https://mitra.example/statuses/abc' });
		const bodyBuf = Buffer.from(body, 'utf8');
		const digestB64 = createHash('sha256').update(bodyBuf).digest('base64');
		const contentDigest = `sha-256=:${digestB64}=`;

		const keyId = 'https://mitra.example/users/alice#main-key';
		const created = Math.floor(Date.now() / 1000);
		const alg = 'rsa-v1_5-sha256';
		const signatureInput = `sig1=("@method" "@target-uri" "content-digest");keyid="${keyId}";created=${created};alg="${alg}"`;
		const base = [
			'"@method": POST',
			`"@target-uri": ${dialedUrl}`,
			`"content-digest": ${contentDigest}`,
			`"@signature-params": ("@method" "@target-uri" "content-digest");keyid="${keyId}";created=${created};alg="${alg}"`,
		].join('\n');
		const sig = await webcrypto.subtle.sign(
			{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
			signingKey,
			new TextEncoder().encode(base),
		);
		const req = {
			method: 'POST',
			originalUrl: '/uid/1/inbox',
			url: '/uid/1/inbox',
			ip: '203.0.113.7',
			rawBody: bodyBuf,
			body: JSON.parse(body),
			headers: {
				'content-type': 'application/activity+json',
				host: 'nodebb.example',
				'content-digest': contentDigest,
				'signature-input': signatureInput,
				signature: `sig1=:${Buffer.from(sig).toString('base64')}:`,
			},
		};

		const verified = await signatures.verify(req, async () => pubPem);
		assert.strictEqual(verified, true, 'verification failed despite a valid Host-header-based target URI');
	});
});
