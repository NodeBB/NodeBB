'use strict';

const nconf = require('nconf');
const winston = require('winston');
const { createHash, createSign, createVerify, getHashes } = require('crypto');
const { CronJob } = require('cron');

const request = require('../request');
const db = require('../database');
const meta = require('../meta');
const categories = require('../categories');
const posts = require('../posts');
const messaging = require('../messaging');
const user = require('../user');
const utils = require('../utils');
const ttl = require('../cache/ttl');
const batch = require('../batch');
const analytics = require('../analytics');
const crypto = require('crypto');

const requestCache = ttl({
	name: 'ap-request-cache',
	max: 5000,
	ttl: 1000 * 60 * 5, // 5 minutes
});
const probeCache = ttl({
	name: 'ap-probe-cache',
	max: 500,
	ttl: 1000 * 60 * 60, // 1 hour
});
const probeRateLimit = ttl({
	name: 'ap-probe-rate-limit-cache',
	ttl: 1000 * 3, // 3 seconds
});

const ActivityPub = module.exports;

ActivityPub._constants = Object.freeze({
	uid: -2,
	publicAddress: 'https://www.w3.org/ns/activitystreams#Public',
	acceptablePublicAddresses: ['https://www.w3.org/ns/activitystreams#Public', 'as:Public', 'Public'],
	acceptableTypes: [
		'application/activity+json',
		'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
	],
	acceptedPostTypes: [
		'Note', 'Page', 'Article', 'Question', 'Video',
	],
	acceptableActorTypes: new Set(['Application', 'Organization', 'Person', 'Service']),
	acceptableGroupTypes: new Set(['Group']),
	requiredActorProps: ['inbox'],
	acceptedProtocols: ['https', ...(process.env.CI === 'true' ? ['http'] : [])],
	acceptable: {
		customFields: new Set(['PropertyValue', 'Link', 'Note']),
		contextTypes: new Set(['Collection', 'CollectionPage', 'OrderedCollection', 'OrderedCollectionPage']),
	},
});
ActivityPub._cache = requestCache;
ActivityPub._sent = new Map(); // used only in local tests

ActivityPub.helpers = require('./helpers');
ActivityPub.inbox = require('./inbox');
ActivityPub.mocks = require('./mocks');
ActivityPub.notes = require('./notes');
ActivityPub.contexts = require('./contexts');
ActivityPub.actors = require('./actors');
ActivityPub.instances = require('./instances');
ActivityPub.feps = require('./feps');
ActivityPub.rules = require('./rules');
ActivityPub.relays = require('./relays');
ActivityPub.out = require('./out');

ActivityPub.startJobs = () => {
	ActivityPub.helpers.log('[activitypub/jobs] Registering jobs.');
	async function tryCronJob(method) {
		if (!meta.config.activitypubEnabled) {
			return;
		}
		try {
			await method();
		} catch (err) {
			winston.error(err.stack);
		}
	}
	new CronJob('0 0 * * *', async () => {
		await tryCronJob(async () => {
			await ActivityPub.notes.prune();
			await db.sortedSetsRemoveRangeByScore(['activities:datetime'], '-inf', Date.now() - 604800000);
		});
	}, null, true, null, null, false); // change last argument to true for debugging

	new CronJob('*/30 * * * *', async () => {
		await tryCronJob(ActivityPub.actors.prune);
	}, null, true, null, null, false); // change last argument to true for debugging

	new CronJob('0 * * * * *', async () => {
		await tryCronJob(retryFailedMessages);
	}, null, true, null, null, false);
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
			try {
				const { hostname } = new URL(id);
				return hostname !== nconf.get('url_parsed').hostname;
			} catch (err) {
				winston.error(`[activitypub/resolveInboxes] Invalid id: ${id}`);
				return false;
			}
		});
	}

	await ActivityPub.actors.assert(ids);

	// Remove non-asserted targets
	const exists = await db.isSortedSetMembers('usersRemote:lastCrawled', ids);
	ids = ids.filter((_, idx) => exists[idx]);

	await batch.processArray(ids, async (currentIds) => {
		const isCategory = await db.exists(currentIds.map(id => `categoryRemote:${id}`));
		const [cids, uids] = currentIds.reduce(([cids, uids], id, idx) => {
			const array = isCategory[idx] ? cids : uids;
			array.push(id);
			return [cids, uids];
		}, [[], []]);
		const categoryData = await categories.getCategoriesFields(cids, ['inbox', 'sharedInbox']);
		const userData = await user.getUsersFields(uids, ['inbox', 'sharedInbox']);
		currentIds.forEach((id) => {
			if (cids.includes(id)) {
				const data = categoryData[cids.indexOf(id)];
				inboxes.add(data.sharedInbox || data.inbox);
			} else if (uids.includes(id)) {
				const data = userData[uids.indexOf(id)];
				inboxes.add(data.sharedInbox || data.inbox);
			}
		});
	}, {
		batch: 500,
	});

	let inboxArr = Array.from(inboxes);

	// Filter out blocked instances
	const blocked = [];
	inboxArr = inboxArr.filter((inbox) => {
		const { hostname } = new URL(inbox);
		const allowed = ActivityPub.instances.isAllowed(hostname);
		if (!allowed) {
			blocked.push(inbox);
		}
		return allowed;
	});
	if (blocked.length) {
		ActivityPub.helpers.log(`[activitypub/resolveInboxes] Not delivering to blocked instances: ${blocked.join(', ')}`);
	}

	return inboxArr;
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
		keyId = `${nconf.get('url')}${id > 0 ? `/category/${id}` : '/actor'}#key`;
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

	// Verify the signature string via public key
	try {
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

	const { hostname } = new URL(uri);
	const allowed = ActivityPub.instances.isAllowed(hostname);
	if (!allowed) {
		ActivityPub.helpers.log(`[activitypub/get] Not retrieving ${uri}, domain is blocked.`);
		const e = new Error(`[[error:activitypub.get-failed]]`);
		e.code = `ap_get_domain_blocked`;
		throw e;
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

async function sendMessage(uri, id, type, payload) {
	try {
		const keyData = await ActivityPub.getPrivateKey(type, id);
		const headers = await ActivityPub.sign(keyData, uri, payload);

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
			return true;
		}
		if (typeof body === 'object') {
			throw new Error(JSON.stringify(body));
		}
		throw new Error(String(body));
	} catch (e) {
		ActivityPub.helpers.log(`[activitypub/send] Could not send ${payload.type} to ${uri}; error: ${e.message}`);
		return false;
	}
}

ActivityPub.send = async (type, id, targets, payload) => {
	if (!meta.config.activitypubEnabled) {
		return ActivityPub.helpers.log('[activitypub/send] Federation not enabled; not sending.');
	}

	ActivityPub.helpers.log(`[activitypub/send] ${payload.id}`);

	if (!Array.isArray(targets)) {
		targets = [targets];
	}

	if (process.env.hasOwnProperty('CI')) {
		ActivityPub._sent.set(payload.id, { payload, targets });
		return;
	}

	const inboxes = await ActivityPub.resolveInboxes(targets);

	const actor = ActivityPub.helpers.resolveActor(type, id);

	payload = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		actor,
		...payload,
	};

	const oneMinute = 1000 * 60;
	batch.processArray(inboxes, async (inboxBatch) => {
		const retryQueueAdd = [];
		const retryQueuedSet = [];

		await Promise.all(inboxBatch.map(async (uri) => {
			const ok = await sendMessage(uri, id, type, payload);
			if (!ok) {
				const queueId = crypto.createHash('sha256').update(`${type}:${id}:${uri}`).digest('hex');
				const nextTryOn = Date.now() + oneMinute;
				retryQueueAdd.push(['ap:retry:queue', nextTryOn, queueId]);
				retryQueuedSet.push([`ap:retry:queue:${queueId}`, {
					queueId,
					uri,
					id,
					type,
					attempts: 1,
					timestamp: nextTryOn,
					payload: JSON.stringify(payload),
				}]);
			}
		}));

		if (retryQueueAdd.length) {
			await Promise.all([
				db.sortedSetAddBulk(retryQueueAdd),
				db.setObjectBulk(retryQueuedSet),
			]);
		}
	}, {
		batch: 50,
		interval: 100,
	}).catch(err => winston.error(err.stack));
};

async function retryFailedMessages() {
	const queueIds = await db.getSortedSetRangeByScore('ap:retry:queue', 0, 50, '-inf', Date.now());
	const queuedData = (await db.getObjects(queueIds.map(id => `ap:retry:queue:${id}`)));

	const retryQueueAdd = [];
	const retryQueuedSet = [];
	const queueIdsToRemove = [];

	const oneMinute = 1000 * 60;
	await Promise.all(queuedData.map(async (data, index) => {
		const queueId = queueIds[index];
		if (!data) {
			queueIdsToRemove.push(queueId);
			return;
		}

		const { uri, id, type, attempts, payload } = data;
		if (!uri || !id || !type || !payload || attempts > 10) {
			queueIdsToRemove.push(queueId);
			return;
		}
		let payloadObj;
		try {
			payloadObj = JSON.parse(payload);
		} catch (err) {
			queueIdsToRemove.push(queueId);
			return;
		}
		const ok = await sendMessage(uri, id, type, payloadObj);
		if (ok) {
			queueIdsToRemove.push(queueId);
		} else {
			const nextAttempt = (parseInt(attempts, 10) || 0) + 1;
			const timeout = (2 ** nextAttempt) * oneMinute; // exponential backoff
			const nextTryOn = Date.now() + timeout;
			retryQueueAdd.push(['ap:retry:queue', nextTryOn, queueId]);
			retryQueuedSet.push([`ap:retry:queue:${queueId}`, {
				attempts: nextAttempt,
				timestamp: nextTryOn,
			}]);
		}
	}));

	await Promise.all([
		db.sortedSetAddBulk(retryQueueAdd),
		db.setObjectBulk(retryQueuedSet),
		db.sortedSetRemove('ap:retry:queue', queueIdsToRemove),
		db.deleteAll(queueIdsToRemove.map(id => `ap:retry:queue:${id}`)),
	]);
}

ActivityPub.record = async ({ id, type, actor }) => {
	const now = Date.now();
	const { hostname } = new URL(actor);

	await Promise.all([
		db.sortedSetAdd(`activities:datetime`, now, id),
		ActivityPub.instances.log(hostname),
		analytics.increment(['activities', `activities:byType:${type}`, `activities:byHost:${hostname}`]),
	]);
};

ActivityPub.buildRecipients = async function (object, { pid, uid, cid }) {
	/**
	 * - Builds a list of targets for activitypub.send to consume
	 * - Extends to and cc since the activity can be addressed more widely
	 * - Optional parameters:
	 *     - `cid`: includes followers of the passed-in cid (local only, can also be an array)
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
		cid = Array.isArray(cid) ? cid : [cid];
		await Promise.all(cid.map(async (cid) => {
			const cidFollowers = await ActivityPub.notes.getCategoryFollowers(cid);
			followers = followers.concat(cidFollowers);
			const followersUrl = `${nconf.get('url')}/category/${cid}/followers`;
			if (!to.has(followersUrl)) {
				cc.add(followersUrl);
			}
		}));
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

ActivityPub.checkHeader = async (url, timeout) => {
	timeout = timeout || meta.config.activitypubProbeTimeout || 2000;

	try {
		const { hostname } = new URL(url);
		const { response } = await request.head(url, {
			timeout,
		});
		const { headers } = response;

		// headers.link =
		if (headers && headers.link) {
			// Multiple link headers could be combined
			const links = headers.link.split(',');
			let apLink = false;

			links.forEach((link) => {
				let parts = link.split(';');
				const url = parts.shift().match(/<(.+)>/)[1];
				if (!url || apLink) {
					return;
				}

				parts = parts
					.map(p => p.trim())
					.reduce((memo, cur) => {
						cur = cur.split('=');
						if (cur.length < 2) {
							cur.push('');
						}
						memo[cur[0]] = cur[1].slice(1, -1);
						return memo;
					}, {});

				if (parts.rel === 'alternate' && parts.type === 'application/activity+json') {
					apLink = url;
				}
			});

			if (apLink) {
				const { hostname: compare } = new URL(apLink);
				if (hostname !== compare) {
					apLink = false;
				}
			}

			return apLink;
		}

		return false;
	} catch (e) {
		ActivityPub.helpers.log(`[activitypub/checkHeader] Failed on ${url}: ${e.message}`);
		return false;
	}
};

ActivityPub.probe = async ({ uid, url }) => {
	/**
	 * Checks whether a passed-in id or URL is an ActivityPub object and can be mapped to a local representation
	 *   - `uid` is optional (links to private messages won't match without uid)
	 *   - Returns a relative path if already available, true if not, and false otherwise.
	 */

	// Disable on config setting; restrict lookups to HTTPS-enabled URLs only
	const { activitypubProbe } = meta.config;
	const { protocol, host } = new URL(url);
	if (!activitypubProbe || protocol !== 'https:' || host === nconf.get('url_parsed').host) {
		return false;
	}

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

	// Guests not allowed to use expensive logic path
	if (!uid) {
		return false;
	}

	// One request allowed every 3 seconds (configured at top)
	const limited = probeRateLimit.get(uid);
	if (limited) {
		return false;
	}

	// Cached result
	if (probeCache.has(url)) {
		return probeCache.get(url);
	}

	// Opportunistic HEAD
	try {
		probeRateLimit.set(uid, true);
		const probe = await ActivityPub.checkHeader(url).then((result) => {
			probeCache.set(url, result);
			return !!result;
		});

		return !!probe;
	} catch (e) {
		if (e.name === 'TimeoutError') {
			// Return early but retry for caching purposes
			ActivityPub.checkHeader(url, 1000 * 60).then((result) => {
				probeCache.set(url, result);
			}).catch(err => ActivityPub.helpers.log(err.stack));
			return false;
		}
	}

	probeCache.set(url, false);
	return false;
};
