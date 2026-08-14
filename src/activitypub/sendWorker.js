'use strict';

/**
 * ActivityPub outbound send worker (child process).
 *
 * Forked from index.js. Receives send tasks via IPC, signs payloads,
 * POSTs to remote inboxes, and reports results back to the parent.
 *
 * Environment variable: AP_SEND_CHILD=true
 */

const { fetch, Agent } = require('undici');
const { check, lookup } = require('../ssrf');
const winston = require('winston');
const nconf = require('nconf');
const { version } = require('../../package.json');

const DEBUG = process.env.AP_SEND_DEBUG === 'true';
const userAgent = `NodeBB/${version.split('.').shift()}.x (${nconf.get('url')})`;

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
// Worker message handler
// ---------------------------------------------------------------------------

// Track in-flight task IDs for uncaughtException handler
const pendingTaskIds = new Set();

// Track active task AbortController instances for immediate shutdown abort
const activeTasks = new Map(); // id -> AbortController

process.on('message', async (message) => {
	if (!message || typeof message.type !== 'string') {
		return;
	}

	// Handle shutdown before the switch — avoids fallthrough eslint issue
	// and ensures immediate exit without waiting for switch dispatch
	if (message.type === 'shutdown') {
		for (const [, controller] of activeTasks) {
			controller.abort();
		}
		process.send({ type: 'ack' });
		process.exit(0);
	}

	switch (message.type) {
		case 'send': {
			const { id, uri, payload, digest, key, keyId } = message;

			// Validate required fields
			if (!uri || !payload || !digest || !key || !keyId) {
				process.send({
					type: 'result',
					id,
					success: false,
					error: 'missing fields',
				});
				return;
			}

			pendingTaskIds.add(id);

			// Create AbortController for this task — allows immediate abort on shutdown
			const controller = new AbortController();
			activeTasks.set(id, controller);

			try {
				// SSRF check
				const { ok } = await check(uri);
				if (!ok) {
					process.send({
						type: 'result',
						id,
						success: false,
						error: 'SSRF check failed — reserved IP address',
					});
					pendingTaskIds.delete(id);
					activeTasks.delete(id);
					return;
				}

				// Sign
				const headers = await sign(key, keyId, uri, digest);

				// Debug: log full request details
				if (DEBUG) {
					winston.debug(`[activitypub/send] REQUEST uri=${uri}`);
					winston.debug(`[activitypub/send] REQUEST headers=${JSON.stringify(headers)}`);
					winston.debug(`[activitypub/send] REQUEST payload=${payload.substring(0, 500)}`);
				}

				// POST — redirect: 'manual' prevents SSRF via HTTP redirect
				// Combined signal: task-specific abort (shutdown) + 10s timeout
				const timeoutSignal = AbortSignal.timeout(10000);
				const combinedSignal = AbortSignal.any([controller.signal, timeoutSignal]);

				const response = await fetch(uri, {
					method: 'POST',
					headers: {
						...headers,
						'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
						'user-agent': userAgent,
					},
					body: payload,
					signal: combinedSignal,
					redirect: 'manual',
					dispatcher: agent,
				});

				// Validate Content-Length to prevent memory exhaustion
				const contentLength = response.headers.get('content-length');
				if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
					process.send({
						type: 'result',
						id,
						success: false,
						error: 'Response body exceeds 10MB limit',
					});
					activeTasks.delete(id);
					pendingTaskIds.delete(id);
					return;
				}

				if (String(response.status).startsWith('2')) {
					process.send({
						type: 'result',
						id,
						success: true,
					});
				} else {
					let bodyText = '';
					try {
						bodyText = await response.text();
					} catch (e) { /* ignore */ }

					// Debug: log full response details
					if (DEBUG) {
						winston.debug(`[activitypub/send] RESPONSE status=${response.status} headers=${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
						winston.debug(`[activitypub/send] RESPONSE body=${bodyText.substring(0, 1000)}`);
					}

					process.send({
						type: 'result',
						id,
						success: false,
						error: `HTTP ${response.status}: ${bodyText}`,
					});
				}
			} catch (e) {
				process.send({
					type: 'result',
					id,
					success: false,
					error: e.message || 'unknown error',
				});
			} finally {
				pendingTaskIds.delete(id);
				activeTasks.delete(id);
			}
			break;
		}

		default:
			winston.warn(`[activitypub/send] Unknown message type: ${message.type}`);
			break;
	}
});

// Uncaught exception handler — send error back if task ID is known, then exit
process.on('uncaughtException', (err) => {
	if (pendingTaskIds.size > 0) {
		// Send error for the first pending task (there should only be one)
		const taskId = pendingTaskIds.values().next().value;
		try {
			process.send({
				type: 'result',
				id: taskId,
				success: false,
				error: `uncaughtException: ${err.message}`,
			});
		} catch (e) { /* IPC may be broken */ }
	}
	winston.error(`[activitypub/send] Uncaught exception: ${err.stack}`);
	process.exit(1);
});

// Emit ready signal after startup
process.send({ type: 'ready' });
