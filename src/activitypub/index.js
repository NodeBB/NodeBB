'use strict';

const nconf = require('nconf');
const winston = require('winston');
const { createHash, createSign, createVerify, getHashes } = require('crypto');
const { CronJob } = require('cron');

const request = require('../request');
const db = require('../database');
const meta = require('../meta');
const posts = require('../posts');
const messaging = require('../messaging');
const user = require('../user');
const utils = require('../utils');
const ttl = require('../cache/ttl');
const lru = require('../cache/lru');
const batch = require('../batch');
const pubsub = require('../pubsub');
const analytics = require('../analytics');

const requestCache = ttl({
	max: 5000,
	ttl: 1000 * 60 * 5, // 5 minutes
});
const probeCache = ttl({
	max: 500,
	ttl: 1000 * 60 * 60, // 1 hour
});

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
	acceptableActorTypes: new Set(['Application', 'Group', 'Organization', 'Person', 'Service']),
	requiredActorProps: ['inbox', 'outbox'],
	acceptedProtocols: ['https', ...(process.env.CI === 'true' ? ['http'] : [])],
	acceptable: {
		customFields: new Set(['PropertyValue', 'Link', 'Note']),
	},
});
ActivityPub._cache = requestCache;

ActivityPub.helpers = require('./helpers');
ActivityPub.inbox = require('./inbox');
ActivityPub.mocks = require('./mocks');
ActivityPub.notes = require('./notes');
ActivityPub.contexts = require('./contexts');
ActivityPub.actors = require('./actors');
ActivityPub.instances = require('./instances');

ActivityPub.startJobs = () => {
	ActivityPub.helpers.log('[activitypub/jobs] Registering jobs.');
	new CronJob('0 0 * * *', async () => {
		if (!meta.config.activitypubEnabled) {
			return;
		}
		try {
			await ActivityPub.notes.prune();
			await db.sortedSetsRemoveRangeByScore(['activities:datetime'], '-inf', Date.now() - 604800000);
		} catch (err) {
			winston.error(err.stack);
		}
	}, null, true, null, null, false); // change last argument to true for debugging

	new CronJob('*/30 * * * *', async () => {
		if (!meta.config.activitypubEnabled) {
			return;
		}
		try {
			await ActivityPub.actors.prune();
		} catch (err) {
			winston.error(err.stack);
		}
	}, null, true, null, null, false); // change last argument to true for debugging
};

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
	await batch.processArray(ids, async (currentIds) => {
		const usersData = await user.getUsersFields(currentIds, ['inbox', 'sharedInbox']);
		usersData.forEach((u) => {
			if (u && (u.sharedInbox || u.inbox)) {
				inboxes.add(u.sharedInbox || u.inbox);
			}
		});
	}, {
		batch: 500,
	});

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
	ActivityPub.helpers.log('[activitypub/verify] Starting signature verification...');
	if (!req.headers.hasOwnProperty('signature')) {
		ActivityPub.helpers.log('[activitypub/verify]   Failed, no signature header.');
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
		ActivityPub.helpers.log(`[activitypub/verify] Retrieving pubkey for ${keyId}`);
		const { publicKeyPem } = await ActivityPub.fetchPublicKey(keyId);

		const verify = createVerify('sha256');
		verify.update(signed_string);
		verify.end();
		ActivityPub.helpers.log('[activitypub/verify] Attempting signed string verification');
		const verified = verify.verify(publicKeyPem, signature, 'base64');
		return verified;
	} catch (e) {
		ActivityPub.helpers.log('[activitypub/verify]   Failed, key retrieval or verification failure.');
		return false;
	}
};

ActivityPub.get = async (type, id, uri, options) => {
	if (!meta.config.activitypubEnabled) {
		throw new Error('[[error:activitypub.not-enabled]]');
	}

	options = {
		cache: true,
		...options,
	};
	const cacheKey = [id, uri].join(';');
	const cached = requestCache.get(cacheKey);
	if (options.cache && cached !== undefined) {
		return cached;
	}

	const keyData = await ActivityPub.getPrivateKey(type, id);
	const headers = id >= 0 ? await ActivityPub.sign(keyData, uri) : {};
	ActivityPub.helpers.log(`[activitypub/get] ${uri}`);
	try {
		const { response, body } = await request.get(uri, {
			headers: {
				...headers,
				...options.headers,
				Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			},
			timeout: 5000,
		});

		if (!String(response.statusCode).startsWith('2')) {
			winston.verbose(`[activitypub/get] Received ${response.statusCode} when querying ${uri}`);
			if (body.hasOwnProperty('error')) {
				winston.verbose(`[activitypub/get] Error received: ${body.error}`);
			}

			const e = new Error(`[[error:activitypub.get-failed]]`);
			e.code = `ap_get_${response.statusCode}`;
			throw e;
		}

		requestCache.set(cacheKey, body);
		return body;
	} catch (e) {
		if (String(e.code).startsWith('ap_get_')) {
			throw e;
		}

		// Handle things like non-json body, etc.
		const { cause } = e;
		throw new Error(`[[error:activitypub.get-failed]]`, { cause });
	}
};

ActivityPub.retryQueue = lru({ name: 'activitypub-retry-queue', max: 4000, ttl: 1000 * 60 * 60 * 24 * 60 });

// handle clearing retry queue from another member of the cluster
pubsub.on(`activitypub-retry-queue:lruCache:del`, (keys) => {
	if (Array.isArray(keys)) {
		keys.forEach(key => clearTimeout(ActivityPub.retryQueue.get(key)));
	}
});

async function sendMessage(uri, id, type, payload, attempts = 1) {
	const keyData = await ActivityPub.getPrivateKey(type, id);
	const headers = await ActivityPub.sign(keyData, uri, payload);
	ActivityPub.helpers.log(`[activitypub/send] ${uri}`);
	try {
		const { response, body } = await request.post(uri, {
			headers: {
				...headers,
				'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			},
			body: payload,
			timeout: 10000, // configurable?
		});

		if (String(response.statusCode).startsWith('2')) {
			ActivityPub.helpers.log(`[activitypub/send] Successfully sent ${payload.type} to ${uri}`);
		} else {
			if (typeof body === 'object') {
				throw new Error(JSON.stringify(body));
			}
			throw new Error(String(body));
		}
	} catch (e) {
		ActivityPub.helpers.log(`[activitypub/send] Could not send ${payload.type} to ${uri}; error: ${e.message}`);
		// add to retry queue
		if (attempts < 12) { // stop attempting after ~2 months
			const timeout = (4 ** attempts) * 1000; // exponential backoff
			const queueId = `${payload.type}:${payload.id}:${new URL(uri).hostname}`;
			const timeoutId = setTimeout(() => sendMessage(uri, id, type, payload, attempts + 1), timeout);
			ActivityPub.retryQueue.set(queueId, timeoutId);

			ActivityPub.helpers.log(`[activitypub/send] Added ${payload.type} to ${uri} to retry queue for ${timeout}ms`);
		} else {
			winston.warn(`[activitypub/send] Max attempts reached for ${payload.type} to ${uri}; giving up on sending`);
		}
	}
}

ActivityPub.send = async (type, id, targets, payload) => {
	if (!meta.config.activitypubEnabled) {
		return ActivityPub.helpers.log('[activitypub/send] Federation not enabled; not sending.');
	}

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

	await batch.processArray(
		inboxes,
		async inboxBatch => Promise.all(inboxBatch.map(async uri => sendMessage(uri, id, type, payload))),
		{
			batch: 50,
			interval: 100,
		},
	);
};

ActivityPub.record = async ({ id, type, actor }) => {
	const now = Date.now();
	const { hostname } = new URL(actor);

	await Promise.all([
		db.sortedSetAdd(`activities:datetime`, now, id),
		db.sortedSetAdd('domains:lastSeen', now, hostname),
		analytics.increment(['activities', `activities:byType:${type}`, `activities:byHost:${hostname}`]),
	]);
};

ActivityPub.buildRecipients = async function (object, { pid, uid, cid }) {
	/**
	 * - Builds a list of targets for activitypub.send to consume
	 * - Extends to and cc since the activity can be addressed more widely
	 * - Optional parameters:
	 *     - `cid`: includes followers of the passed-in cid (local only)
	 *     - `uid`: includes followers of the passed-in uid (local only)
	 *     - `pid`: includes post announcers and all topic participants
	 */
	let { to, cc } = object;
	to = new Set(to);
	cc = new Set(cc);

	let followers = [];
	if (uid) {
		followers = await db.getSortedSetMembers(`followersRemote:${uid}`);
		const followersUrl = `${nconf.get('url')}/uid/${uid}/followers`;
		if (!to.has(followersUrl)) {
			cc.add(followersUrl);
		}
	}

	if (cid) {
		const cidFollowers = await ActivityPub.notes.getCategoryFollowers(cid);
		followers = followers.concat(cidFollowers);
		const followersUrl = `${nconf.get('url')}/category/${cid}/followers`;
		if (!to.has(followersUrl)) {
			cc.add(followersUrl);
		}
	}

	const targets = new Set([...followers, ...to, ...cc]);

	// Remove any ids that aren't asserted actors
	const exists = await db.isSortedSetMembers('usersRemote:lastCrawled', [...targets]);
	Array.from(targets).forEach((uri, idx) => {
		if (!exists[idx]) {
			targets.delete(uri);
		}
	});

	// Topic posters, post announcers and their followers
	if (pid) {
		const tid = await posts.getPostField(pid, 'tid');
		const participants = (await db.getSortedSetMembers(`tid:${tid}:posters`))
			.filter(uid => !utils.isNumber(uid)); // remote users only
		const announcers = (await ActivityPub.notes.announce.list({ pid })).map(({ actor }) => actor);
		const auxiliaries = Array.from(new Set([...participants, ...announcers]));
		const auxiliaryFollowers = (await user.getUsersFields(auxiliaries, ['followersUrl']))
			.filter(o => o.hasOwnProperty('followersUrl'))
			.map(({ followersUrl }) => followersUrl);
		[...auxiliaries].forEach(uri => uri && targets.add(uri));
		[...auxiliaries, ...auxiliaryFollowers].forEach(uri => uri && cc.add(uri));
	}

	return {
		to: [...to],
		cc: [...cc],
		targets,
	};
};

ActivityPub.probe = async ({ uid, url }) => {
	/**
	 * Checks whether a passed-in id or URL is an ActivityPub object and can be mapped to a local representation
	 *   - `uid` is optional (links to private messages won't match without uid)
	 *   - Returns a relative path if already available, true if not, and false otherwise.
	 */

	// Known resources
	const [isNote, isMessage, isActor, isActorUrl] = await Promise.all([
		posts.exists(url),
		messaging.messageExists(url),
		db.isSortedSetMember('usersRemote:lastCrawled', url), // if url is same as id
		db.isObjectField('remoteUrl:uid', url),
	]);
	switch (true) {
		case isNote: {
			return `/post/${encodeURIComponent(url)}`;
		}

		case isMessage: {
			if (uid) {
				const { roomId } = await messaging.getMessageFields(url, ['roomId']);
				const canView = await messaging.canViewMessage(url, roomId, uid);
				if (canView) {
					return `/message/${encodeURIComponent(url)}`;
				}
			}
			break;
		}

		case isActor: {
			const slug = await user.getUserField(url, 'userslug');
			return `/user/${slug}`;
		}

		case isActorUrl: {
			const uid = await db.getObjectField('remoteUrl:uid', url);
			const slug = await user.getUserField(uid, 'userslug');
			return `/user/${slug}`;
		}
	}

	// Cached result
	if (probeCache.has(url)) {
		return probeCache.get(url);
	}

	// Opportunistic HEAD
	async function checkHeader(timeout) {
		const { response } = await request.head(url, {
			timeout,
		});
		const { headers } = response;
		if (headers && headers.link) {
			let parts = headers.link.split(';');
			parts.shift();
			parts = parts
				.map(p => p.trim())
				.reduce((memo, cur) => {
					cur = cur.split('=');
					memo[cur[0]] = cur[1].slice(1, -1);
					return memo;
				}, {});

			if (parts.rel === 'alternate' && parts.type === 'application/activity+json') {
				probeCache.set(url, true);
				return true;
			}
		}

		return false;
	}
	try {
		return await checkHeader(meta.config.activitypubProbeTimeout || 2000);
	} catch (e) {
		if (e.name === 'TimeoutError') {
			// Return early but retry for caching purposes
			checkHeader(1000 * 60).then((result) => {
				probeCache.set(url, result);
			}).catch(err => ActivityPub.helpers.log(err.stack));
			return false;
		}
	}

	probeCache.set(url, false);
	return false;
};
