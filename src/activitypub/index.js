'use strict';

const nconf = require('nconf');
const winston = require('winston');
const { createHash, createSign, createVerify, getHashes } = require('crypto');

const request = require('../request');
const db = require('../database');
const meta = require('../meta');
const user = require('../user');
const utils = require('../utils');
const ttl = require('../cache/ttl');

const requestCache = ttl({ ttl: 1000 * 60 * 5 }); // 5 minutes
const ActivityPub = module.exports;

ActivityPub._constants = Object.freeze({
	uid: -2,
	publicAddress: 'https://www.w3.org/ns/activitystreams#Public',
	acceptableTypes: [
		'application/activity+json',
		'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
	],
	acceptedPostTypes: [
		'Note', 'Page', 'Article', 'Question',
	],
	acceptedProtocols: ['https', ...(process.env.CI === 'true' ? ['http'] : [])],
});
ActivityPub._cache = requestCache;

ActivityPub.helpers = require('./helpers');
ActivityPub.inbox = require('./inbox');
ActivityPub.mocks = require('./mocks');
ActivityPub.notes = require('./notes');
ActivityPub.actors = require('./actors');

ActivityPub.resolveId = async (uid, id) => {
	try {
		const query = new URL(id);
		({ id } = await ActivityPub.get('uid', uid, id));
		const response = new URL(id);

		if (query.host !== response.host) {
			winston.warn(`[activitypub/resolveId] id resolution domain mismatch: ${query.href} != ${response.href}`);
			return null;
		}

		return id;
	} catch (e) {
		return null;
	}
};

ActivityPub.resolveInboxes = async (ids) => {
	const inboxes = new Set();

	if (!meta.config.activitypubAllowLoopback) {
		ids = ids.filter((id) => {
			const { hostname } = new URL(id);
			return hostname !== nconf.get('url_parsed').hostname;
		});
	}

	await ActivityPub.actors.assert(ids);
	await Promise.all(ids.map(async (id) => {
		const { inbox, sharedInbox } = await user.getUserFields(id, ['inbox', 'sharedInbox']);
		if (sharedInbox || inbox) {
			inboxes.add(sharedInbox || inbox);
		}
	}));

	return Array.from(inboxes);
};

ActivityPub.getPublicKey = async (type, id) => {
	let publicKey;

	try {
		({ publicKey } = await db.getObject(`${type}:${id}:keys`));
	} catch (e) {
		({ publicKey } = await ActivityPub.helpers.generateKeys(type, id));
	}

	return publicKey;
};

ActivityPub.getPrivateKey = async (type, id) => {
	// Sanity checking
	if (!['cid', 'uid'].includes(type) || !utils.isNumber(id) || parseInt(id, 10) < 0) {
		throw new Error('[[error:invalid-data]]');
	}
	id = parseInt(id, 10);
	let privateKey;

	try {
		({ privateKey } = await db.getObject(`${type}:${id}:keys`));
	} catch (e) {
		({ privateKey } = await ActivityPub.helpers.generateKeys(type, id));
	}

	let keyId;
	if (type === 'uid') {
		keyId = `${nconf.get('url')}${id > 0 ? `/uid/${id}` : '/actor'}#key`;
	} else {
		keyId = `${nconf.get('url')}/category/${id}#key`;
	}

	return { key: privateKey, keyId };
};

ActivityPub.fetchPublicKey = async (uri) => {
	// Used for retrieving the public key from the passed-in keyId uri
	const body = await ActivityPub.get('uid', 0, uri);

	if (!body.hasOwnProperty('publicKey')) {
		throw new Error('[[error:activitypub.pubKey-not-found]]');
	}

	return body.publicKey;
};

ActivityPub.sign = async ({ key, keyId }, url, payload) => {
	// Returns string for use in 'Signature' header
	const { host, pathname } = new URL(url);
	const date = new Date().toUTCString();
	let digest = null;

	let headers = '(request-target) host date';
	let signed_string = `(request-target): ${payload ? 'post' : 'get'} ${pathname}\nhost: ${host}\ndate: ${date}`;

	// Calculate payload hash if payload present
	if (payload) {
		const payloadHash = createHash('sha256');
		payloadHash.update(JSON.stringify(payload));
		digest = `SHA-256=${payloadHash.digest('base64')}`;
		headers += ' digest';
		signed_string += `\ndigest: ${digest}`;
	}

	// Sign string using private key
	let signature = createSign('sha256');
	signature.update(signed_string);
	signature.end();
	signature = signature.sign(key, 'base64');

	// Construct signature header
	return {
		date,
		digest,
		signature: `keyId="${keyId}",headers="${headers}",signature="${signature}",algorithm="hs2019"`,
	};
};

ActivityPub.verify = async (req) => {
	winston.verbose('[activitypub/verify] Starting signature verification...');
	if (!req.headers.hasOwnProperty('signature')) {
		winston.verbose('[activitypub/verify]   Failed, no signature header.');
		return false;
	}

	// Break the signature apart
	let { keyId, headers, signature, algorithm, created, expires } = req.headers.signature.split(',').reduce((memo, cur) => {
		const split = cur.split('="');
		const key = split.shift();
		const value = split.join('="');
		memo[key] = value.slice(0, -1);
		return memo;
	}, {});

	const acceptableHashes = getHashes();
	if (algorithm === 'hs2019' || !acceptableHashes.includes(algorithm)) {
		algorithm = 'sha256';
	}

	// Re-construct signature string
	const signed_string = headers.split(' ').reduce((memo, cur) => {
		switch (cur) {
			case '(request-target)': {
				memo.push(`${cur}: ${String(req.method).toLowerCase()} ${req.baseUrl}${req.path}`);
				break;
			}

			case '(created)': {
				memo.push(`${cur}: ${created}`);
				break;
			}

			case '(expires)': {
				memo.push(`${cur}: ${expires}`);
				break;
			}

			default: {
				memo.push(`${cur}: ${req.headers[cur]}`);
				break;
			}
		}

		return memo;
	}, []).join('\n');

	// Verify the signature string via public key
	try {
		// Retrieve public key from remote instance
		winston.verbose(`[activitypub/verify] Retrieving pubkey for ${keyId}`);
		const { publicKeyPem } = await ActivityPub.fetchPublicKey(keyId);

		const verify = createVerify('sha256');
		verify.update(signed_string);
		verify.end();
		winston.verbose('[activitypub/verify] Attempting signed string verification');
		const verified = verify.verify(publicKeyPem, signature, 'base64');
		return verified;
	} catch (e) {
		winston.verbose('[activitypub/verify]   Failed, key retrieval or verification failure.');
		return false;
	}
};

ActivityPub.get = async (type, id, uri) => {
	const cacheKey = [id, uri].join(';');
	if (requestCache.has(cacheKey)) {
		return requestCache.get(cacheKey);
	}

	const keyData = await ActivityPub.getPrivateKey(type, id);
	const headers = id >= 0 ? await ActivityPub.sign(keyData, uri) : {};
	winston.verbose(`[activitypub/get] ${uri}`);
	try {
		const { response, body } = await request.get(uri, {
			headers: {
				...headers,
				Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			},
			timeout: 5000,
		});

		if (!String(response.statusCode).startsWith('2')) {
			winston.error(`[activitypub/get] Received ${response.statusCode} when querying ${uri}`);
			if (body.hasOwnProperty('error')) {
				winston.error(`[activitypub/get] Error received: ${body.error}`);
			}

			throw new Error(`[[error:activitypub.get-failed]]`);
		}

		requestCache.set(cacheKey, body);
		return body;
	} catch (e) {
		// Handle things like non-json body, etc.
		throw new Error(`[[error:activitypub.get-failed]]`);
	}
};

ActivityPub.send = async (type, id, targets, payload) => {
	if (!Array.isArray(targets)) {
		targets = [targets];
	}

	const inboxes = await ActivityPub.resolveInboxes(targets);

	const actor = ActivityPub.helpers.resolveActor(type, id);

	payload = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		actor,
		...payload,
	};

	await Promise.all(inboxes.map(async (uri) => {
		const keyData = await ActivityPub.getPrivateKey(type, id);
		const headers = await ActivityPub.sign(keyData, uri, payload);
		winston.verbose(`[activitypub/send] ${uri}`);
		try {
			const { response, body } = await request.post(uri, {
				headers: {
					...headers,
					'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				},
				body: payload,
			});

			if (String(response.statusCode).startsWith('2')) {
				winston.verbose(`[activitypub/send] Successfully sent ${payload.type} to ${uri}`);
			} else {
				winston.warn(`[activitypub/send] Could not send ${payload.type} to ${uri}; error: ${String(body)}`);
			}
		} catch (e) {
			winston.warn(`[activitypub/send] Could not send ${payload.type} to ${uri}; error: ${e.message}`);
		}
	}));
};
