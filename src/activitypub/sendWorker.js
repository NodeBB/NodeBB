'use strict';

/**
 * ActivityPub outbound send worker.
 *
 * Dedicated worker for workerpool — receives send tasks, signs payloads,
 * POSTs to remote inboxes, and returns results as Promises.
 */

const { fetch, Agent } = require('undici');
const { check, lookup } = require('../ssrf');
const winston = require('winston');
const nconf = require('nconf');
const { version } = require('../../package.json');

const {
	importPrivateKey,
	genDraftSigningString,
	genDraftSignature,
	genDraftSignatureHeader,
} = require('@misskey-dev/node-http-message-signatures');

// ---------------------------------------------------------------------------
// SSRF protection via undici Agent with cached DNS lookup
// ---------------------------------------------------------------------------
// The Agent enforces cached DNS resolution to prevent DNS rebinding attacks.
// The ssrf.js module provides check() for pre-request validation and lookup()
// for cached DNS resolution in the undici dispatcher.
const agent = new Agent({
	maxSockets: 64,
	maxConnections: 256,
	connect: {
		lookup,
	},
});

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB response limit

// ---------------------------------------------------------------------------
// Signing (extracted from signatures.js)
// ---------------------------------------------------------------------------

function getDraftAlgoString(key) {
	const { name } = key.algorithm;
	if (name === 'RSA') {
		return 'rsa-sha256';
	}
	if (name === 'EC') {
		return 'ecdsa-p256-sha256';
	}
	return 'rsa-sha256';
}

async function sign(keyPem, keyId, url, digest) {
	const parsedUrl = new URL(url);
	const date = new Date().toUTCString();

	const headersToSign = {
		date,
		host: parsedUrl.host,
	};

	if (digest) {
		headersToSign.digest = digest;
	}

	const method = digest ? 'POST' : 'GET';
	const privateKey = await importPrivateKey(keyPem, ['sign']);

	const signedHeaders = digest ?
		['(request-target)', 'host', 'date', 'digest'] :
		['(request-target)', 'host', 'date'];

	const signingString = genDraftSigningString(
		{ method, url: parsedUrl.href, headers: headersToSign },
		signedHeaders,
		{ keyId },
	);

	const signature = await genDraftSignature(privateKey, signingString);
	const signatureHeader = genDraftSignatureHeader(signedHeaders, keyId, signature, getDraftAlgoString(privateKey));

	return {
		date,
		...(digest && { digest }),
		signature: signatureHeader,
	};
}

// ---------------------------------------------------------------------------
// Worker task — exported to workerpool
// ---------------------------------------------------------------------------

async function send({ id, uri, payload, digest, key, keyId }) {
	const userAgent = `NodeBB/${version.split('.').shift()}.x (${nconf.get('url')})`;
	const DEBUG = process.env.AP_SEND_DEBUG === 'true';

	try {
		// Validate required fields
		if (!uri || !payload || !digest || !key || !keyId) {
			return { id, success: false, error: 'missing fields' };
		}

		// SSRF check
		const { ok } = await check(uri);
		if (!ok) {
			return { id, success: false, error: 'SSRF check failed — reserved IP address' };
		}

		// Sign
		const headers = await sign(key, keyId, uri, digest);

		// Debug: log full request details
		if (DEBUG) {
			winston.verbose(`[activitypub/send] REQUEST uri=${uri}`);
			winston.verbose(`[activitypub/send] REQUEST headers=${JSON.stringify(headers)}`);
			winston.verbose(`[activitypub/send] REQUEST payload=${payload.substring(0, 500)}`);
		}

		// POST — redirect: 'manual' prevents SSRF via HTTP redirect
		// 10s timeout to prevent stuck tasks
		const timeoutSignal = AbortSignal.timeout(10000);

		const response = await fetch(uri, {
			method: 'POST',
			headers: {
				...headers,
				'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				'user-agent': userAgent,
			},
			body: payload,
			signal: timeoutSignal,
			redirect: 'manual',
			dispatcher: agent,
		});

		// Validate Content-Length to prevent memory exhaustion
		const contentLength = response.headers.get('content-length');
		if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
			return { id, success: false, error: 'Response body exceeds 10MB limit' };
		}

		if (String(response.status).startsWith('2')) {
			return { id, success: true };
		}

		let bodyText = '';
		try {
			bodyText = await response.text();
		} catch (e) { /* ignore */ }

		// Debug: log full response details
		if (DEBUG) {
			winston.verbose(`[activitypub/send] RESPONSE status=${response.status} headers=${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
			winston.verbose(`[activitypub/send] RESPONSE body=${bodyText.substring(0, 1000)}`);
		}

		return { id, success: false, error: `HTTP ${response.status}: ${bodyText}` };
	} catch (e) {
		return { id, success: false, error: e.message || 'unknown error' };
	}
}

const workerpool = require('workerpool');

workerpool.worker({
	send,
});
