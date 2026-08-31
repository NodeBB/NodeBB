'use strict';

const { generateKeyPairSync } = require('crypto');
const process = require('process');
const nconf = require('nconf');
const winston = require('winston');
const validator = require('validator');
const crypto = require('crypto');
const tokenizer = require('sbd');
const pretty = require('pretty');

const meta = require('../meta');
const posts = require('../posts');
const categories = require('../categories');
const messaging = require('../messaging');
const request = require('../request');
const db = require('../database');
const ttl = require('../cache/ttl');
const user = require('../user');
const activitypub = require('.');

// \w only matches ASCII, so match unicode letters/numbers/marks explicitly to support non-ASCII handles
const webfingerRegex = /^(@|acct:)?[\p{L}\p{N}\p{M}_.-]+@.+$/u;
// WebFinger username charset — used to validate actor.preferredUsername before it
// is reflected into a WebFinger query target (audit F-2)
const webfingerUserRegex = /^[\p{L}\p{N}\p{M}_.-]+$/u;
const webfingerCache = ttl({
	name: 'ap-webfinger-cache',
	max: 5000,
	ttl: 1000 * 60 * 60 * 24, // 24 hours
});
// Recent transport-level webfinger query failures (network error / non-200) —
// a broken or revoked webfinger endpoint must not be re-queried on every
// interaction (audit F-4)
const failedWebfingerQueryCache = ttl({
	name: 'ap-webfinger-query-failures',
	max: 5000,
	ttl: 1000 * 60 * 10, // 10 minutes
});
const sha256 = payload => crypto.createHash('sha256').update(payload).digest('hex');

const Helpers = module.exports;

Helpers._webfingerCache = webfingerCache; // exported for tests
Helpers._failedWebfingerQueryCache = failedWebfingerQueryCache; // exported for tests

Helpers._test = (method, args) => {
	// because I am lazy and I probably wrote some variant of this below code 1000 times already
	setTimeout(async () => {
		try {
			console.log(await method.apply(method, args));
		} catch (e) {
			console.log('Exception thrown', e);
		}
	}, 2500);
};
// process.nextTick(() => {
// Helpers._test(activitypub.notes.assert, [1, `https://`]);
// });
let _lastLog;
Helpers.log = (message) => {
	if (!message) {
		return _lastLog;
	}
	_lastLog = message;
	if (process.env.NODE_ENV === 'development') {
		winston.verbose(message);
	}
};

Helpers._hasValidSelfLink = (actorId, actor) => {
	// Check if the actor document has a self-link pointing to its own URI.
	// This is used as a fallback for legacy actors when WebFinger query fails.
	// We look for an explicit { rel: 'self' } link, NOT just a `url` field
	// which any actor can set regardless of whether it's a valid self-reference.
	if (!actor || typeof actor !== 'object') {
		return false;
	}

	// Check for `link` array with explicit rel=self pointing to actorId
	if (Array.isArray(actor.link)) {
		return actor.link.some(
			l =>
				(l && typeof l === 'object' && l.rel === 'self' && l.href === actorId) ||
				(typeof l === 'string' && l === actorId),
		);
	}

	return false;
};

Helpers.isUri = (value) => {
	if (typeof value !== 'string') {
		value = String(value);
	}

	return validator.isURL(value, {
		require_protocol: true,
		require_host: true,
		protocols: activitypub._constants.acceptedProtocols,
		require_valid_protocol: true,
		require_tld: !meta.config.activitypubAllowLoopback,
	});
};

Helpers.assertAccept = (accept) => {
	if (!accept) {
		return false;
	}

	const normalized = accept
		.split(',')
		.map(s => s.trim().replace(/\s*;\s*/g, ';')) // spec allows spaces around semi-colon
		.join(',');

	return activitypub._constants.acceptableTypes.some(type => normalized.includes(type));
};

Helpers.isWebfinger = (value) => {
	// N.B. returns normalized handle, so truthy check!
	if (webfingerRegex.test(value) && !Helpers.isUri(value)) {
		if (value.startsWith('@')) {
			return value.slice(1);
		} else if (value.startsWith('acct:')) {
			return value.slice(5);
		}

		return value;
	}

	return false;
};

// Normalized webfinger cache key: username case is preserved (usernames may
// be case-sensitive), hostname is lowercased (hostnames are case-insensitive;
// URI ids normalize via the URL parser). All webfinger cache read/write paths
// must use this so case variants can never produce divergent entries (audit F-7)
Helpers._webfingerKey = (id) => {
	if (Helpers.isUri(id)) {
		const uri = new URL(id);
		return `${uri.pathname || uri.href}@${uri.hostname}`;
	}

	const [username, hostname] = String(id).split('@');
	return `${(username || '').trim()}@${(hostname || '').trim().toLowerCase()}`;
};

Helpers.query = async (id, { strict = true } = {}) => {
	const isUri = Helpers.isUri(id);
	// username@host ids use acct: URI schema
	const uri = isUri ? new URL(id) : new URL(`acct:${id}`);
	// JS doesn't parse anything other than protocol and pathname from acct: URIs, so we need to just split id manually
	let [username, hostname] = isUri ? [uri.pathname || uri.href, uri.host] : id.split('@');
	if (!username || !hostname) {
		return false;
	}
	username = username.trim();
	hostname = hostname.trim();

	// Reject hostnames that do not round-trip through the URL parser (ports, paths,
	// spaces, ...) — otherwise they would steer the WebFinger request to an
	// unintended host or path (audit F-2)
	try {
		if (new URL(`https://${hostname}/`).hostname.toLowerCase() !== hostname.toLowerCase()) {
			return false;
		}
	} catch (e) {
		return false;
	}

	// Normalize the cache key (hostnames are case-insensitive, audit F-7)
	const key = Helpers._webfingerKey(id);

	// Short-circuit recent transport-level failures for this exact id (audit F-4)
	if (failedWebfingerQueryCache.has(key)) {
		return false;
	}

	const cached = webfingerCache.get(key);
	// A cached entry that carries a hostname only answers queries for the domain
	// it was fetched from — entries stored under this key while querying a
	// different domain must not be served (cross-domain cache poisoning, audit
	// F-1). Entries without a hostname (legacy minimal entries) are served as before.
	const fromSameHost = !cached?.hostname ||
		(typeof cached.hostname === 'string' && cached.hostname.toLowerCase() === hostname.toLowerCase());
	if (cached !== undefined && fromSameHost && !(strict && cached.splitDomain)) {
		return cached;
	}

	// Build the resource from the raw id; URL serialization percent-encodes non-ASCII
	// characters, which URLSearchParams would then encode a second time
	const query = new URLSearchParams({ resource: isUri ? uri.href : `acct:${username}@${hostname}` });

	// Make a webfinger query to retrieve routing information
	let response;
	let body;
	try {
		({ response, body } = await request.get(`https://${hostname}/.well-known/webfinger?${query}`, {
			headers: {
				accept: 'application/jrd+json',
			},
			timeout: 5000,
		}));
	} catch (e) {
		failedWebfingerQueryCache.set(key, true);
		return false;
	}

	if (response.statusCode !== 200) {
		failedWebfingerQueryCache.set(key, true);
		return false;
	}

	// Validate content-type; most servers advertise jrd+json, but some (e.g. GitHub Pages)
	// serve application/octet-stream — attempt to parse as JSON in that case.
	const contentType = (response.headers?.['content-type'] || '').toLowerCase();
	if (contentType && !contentType.includes('application/jrd+json') && !contentType.includes('application/json')) {
		if (!contentType.includes('application/octet-stream')) {
			return false;
		}
		// Try to parse raw response body as JSON for non-compliant servers
		if (typeof body === 'string' || body instanceof Buffer) {
			try {
				body = JSON.parse(typeof body === 'string' ? body : body.toString('utf8'));
			} catch (e) {
				return false;
			}
		}
	}

	if (!body.hasOwnProperty('links')) {
		return false;
	}

	// Parse links to find actor endpoint
	let actorUri = body.links.filter(link => Helpers.assertAccept(link.type) && link.rel === 'self');
	if (actorUri.length) {
		actorUri = actorUri.pop();
		({ href: actorUri } = actorUri);
	}

	let { subject, publicKey } = body;
	// Fix missing scheme
	if (!subject.startsWith('acct:') && !subject.startsWith('did:')) {
		try {
			new URL(subject);
		} catch (e) {
			subject = `acct:${subject}`;
		}
	}

	// Validate that the subject's hostname matches the queried hostname.
	let subjectUrl;
	try {
		subjectUrl = new URL(subject);
	} catch (e) {
		// Invalid URL — reject the response
		return false;
	}

	// Extract hostname from the subject.
	let subjectHostname;
	if (subjectUrl.protocol === 'acct:') {
		// Parse acct:user@hostname from the opaque part
		const opaque = subjectUrl.pathname;
		const atIndex = opaque.lastIndexOf('@');
		if (atIndex === -1) {
			// No @ in acct: subject — malformed
			return false;
		}
		subjectHostname = opaque.slice(atIndex + 1);
	} else {
		subjectHostname = subjectUrl.hostname;
	}

	// Check for split-domain: queried hostname differs from subject hostname.
	const splitDomain = subjectHostname.toLowerCase() !== hostname.toLowerCase();
	if (splitDomain && strict) {
		// Strict mode: reject responses where the subject hostname differs
		return false;
	}

	const payload = {
		subject, username, hostname, actorUri, publicKey,
		_raw: body,
		subjectHostname,
		splitDomain,
	};
	// Cache only by the queried id. Caching by the claimed subject (an "alias")
	// let a response served by one domain answer WebFinger queries about a
	// *different* domain's handle, which the non-strict backref read in
	// verifyActorWebfinger would then trust (audit F-1)
	webfingerCache.set(key, payload);

	return payload;
};

Helpers.verifyActorWebfinger = async (actorId, actor, { allowSelfLinkFallback = false } = {}) => {
	if (!Helpers.isUri(actorId)) {
		return false;
	}

	const idHostname = new URL(actorId).hostname;
	// preferredUsername is reflected verbatim into the WebFinger query target
	// (`username@hostname`); restrict it to the WebFinger username charset so an
	// attacker-supplied value cannot redirect the query to another host (audit F-2)
	const preferredUsername = typeof actor.preferredUsername === 'string' ?
		actor.preferredUsername.trim() : '';
	if (!webfingerUserRegex.test(preferredUsername)) {
		return { ok: false, splitDomain: false, canonicalHandle: null, reason: 'no-backreference' };
	}

	// Step 1: Backreference — non-strict query on domain B (the actor's id host).
	// This allows the WebFinger subject to point elsewhere (split-domain forward target).
	let backref = await Helpers.query(`${preferredUsername}@${idHostname}`, { strict: false });

	// Fallback for legacy actors (pre-split-domain): if WebFinger query fails, check
	// the actor document for a self-link pointing to its own URI. Self-attested,
	// so only allowed for actors with a persisted record — first-time assertions
	// require a live webfinger backref (audit F-4).
	if (!backref && allowSelfLinkFallback && Helpers._hasValidSelfLink(actorId, actor)) {
		backref = {
			actorUri: actorId,
			subject: `acct:${preferredUsername}@${idHostname}`,
			hostname: idHostname,
			subjectHostname: idHostname,
			splitDomain: false,
		};
	}
	if (!backref) {
		return { ok: false, splitDomain: false, canonicalHandle: null, reason: 'no-backreference' };
	}

	// The backreference self-link must point at this exact actor document.
	if (backref.actorUri !== actorId) {
		return { ok: false, splitDomain: false, canonicalHandle: null, reason: 'subject-mismatch' };
	}

	// The WebFinger record must be about the account that was queried — a record
	// served for a different account cannot vouch for this actor (audit F-1)
	if (typeof backref.subject === 'string' && backref.subject.startsWith('acct:')) {
		const opaque = backref.subject.slice(5);
		const subjectAt = opaque.lastIndexOf('@');
		const subjectUser = subjectAt === -1 ? null : opaque.slice(0, subjectAt);
		if (subjectUser !== null && subjectUser !== preferredUsername) {
			return { ok: false, splitDomain: false, canonicalHandle: null, reason: 'subject-mismatch' };
		}
	}

	// The subject's hostname tells us the canonical domain (A).
	// Missing subjectHostname (e.g., legacy cache entries) defaults to same-domain.
	const subjectHost = backref.subjectHostname;
	if (!subjectHost || subjectHost.toLowerCase() === idHostname.toLowerCase()) {
		return {
			ok: true,
			splitDomain: false,
			canonicalHandle: `${preferredUsername}@${idHostname}`,
			reason: null,
		};
	}

	const normalizedSubjectHost = subjectHost.toLowerCase();

	if (!meta.config.activitypubAllowSplitDomain) {
		// Split-domain disabled; reject actors whose subject hostname differs
		return { ok: false, splitDomain: false, canonicalHandle: null, reason: 'forward-mismatch' };
	}

	const forwardResult = await Helpers.query(`${preferredUsername}@${normalizedSubjectHost}`, { strict: true });
	if (!forwardResult || forwardResult.actorUri !== actorId) {
		return { ok: false, splitDomain: false, canonicalHandle: null, reason: 'forward-mismatch' };
	}

	// Cross-check the key the identity domain published against the actor
	// document's key. A mismatch means the canonical domain is vouching for a key
	// it does not hold → reject. Absent keys cannot be compared (some split-domain
	// deployments do not expose the content-domain key in the identity domain's
	// webfinger) → proceed with keyVerified: false (audit F-3).
	let keyVerified = false;
	const forwardPem = forwardResult.publicKey?.publicKeyPem;
	const actorPem = actor.publicKey?.publicKeyPem;
	if (typeof forwardPem === 'string' && forwardPem.trim() &&
		typeof actorPem === 'string' && actorPem.trim()) {
		if (forwardPem.trim() !== actorPem.trim()) {
			return { ok: false, splitDomain: false, canonicalHandle: null, reason: 'key-mismatch' };
		}
		keyVerified = true;
	} else {
		winston.warn(`[activitypub] Split-domain actor ${actorId} verified without key comparison (key missing from forward webfinger or actor document)`);
	}

	const blocked = await activitypub.instances.isAllowed(normalizedSubjectHost);
	if (!blocked.allowed) {
		return {
			ok: false,
			splitDomain: true,
			canonicalHandle: null,
			reason: 'canonical-blocked',
		};
	}

	return {
		ok: true,
		splitDomain: true,
		canonicalHandle: `${preferredUsername}@${normalizedSubjectHost}`,
		reason: 'split-domain',
		keyVerified,
	};
};

Helpers.generateKeys = async (type, id) => {
	activitypub.helpers.log(`[activitypub] Generating RSA key-pair for ${type} ${id}`);
	const {
		publicKey,
		privateKey,
	} = generateKeyPairSync('rsa', {
		modulusLength: 2048,
		publicKeyEncoding: {
			type: 'spki',
			format: 'pem',
		},
		privateKeyEncoding: {
			type: 'pkcs8',
			format: 'pem',
		},
	});

	await db.setObject(`${type}:${id}:keys`, { publicKey, privateKey });
	return { publicKey, privateKey };
};

Helpers.resolveLocalId = async (input) => {
	if (Helpers.isUri(input)) {
		const { host, pathname, hash } = new URL(input);

		if (host === nconf.get('url_parsed').host) {
			const [prefix, value] = pathname.replace(nconf.get('relative_path'), '').split('/').filter(Boolean);

			let activityData = {};
			if (hash.startsWith('#activity')) {
				const [, activity, data, timestamp] = hash.split('/', 4);
				activityData = { activity, data, timestamp };
			}

			switch (prefix) {
				case 'uid':
					return { type: 'user', id: value, ...activityData };

				case 'post':
					return { type: 'post', id: value, ...activityData };

				case 'topic':
					return { type: 'topic', id: value, ...activityData };

				case 'cid':
				case 'category':
					return { type: 'category', id: value, ...activityData };

				case 'user': {
					const uid = await user.getUidByUserslug(value);
					return { type: 'user', id: uid, ...activityData };
				}

				case 'message':
					return { type: 'message', id: value, ...activityData };

				case 'actor':
					return { type: 'application', id: null };
			}

			return { type: null, id: null, ...activityData };
		}

		return { type: null, id: null };
	} else if (String(input).indexOf('@') !== -1) { // Webfinger
		input = decodeURIComponent(input);
		const [slug] = input.replace(/^(acct:|@)/, '').split('@');
		const uid = await user.getUidByUserslug(slug);
		return { type: 'user', id: uid };
	}

	return { type: null, id: null };
};

Helpers.resolveActor = (type, id) => {
	switch (type) {
		case 'user':
		case 'uid': {
			return `${nconf.get('url')}${id > 0 ? `/uid/${id}` : '/actor'}`;
		}

		case 'category':
		case 'cid': {
			return `${nconf.get('url')}${id > 0 ? `/category/${id}` : '/actor'}`;
		}

		default:
			throw new Error('[[error:activitypub.invalid-id]]');
	}
};

Helpers.resolveActivity = async (activity, data, id, resolved) => {
	switch (activity.toLowerCase()) {
		case 'follow': {
			const actor = await Helpers.resolveActor(resolved.type, resolved.id);
			const { actorUri: targetUri } = await Helpers.query(data);
			return {
				'@context': 'https://www.w3.org/ns/activitystreams',
				actor,
				id,
				type: 'Follow',
				object: targetUri,
			};
		}
		case 'announce':
		case 'create': {
			const object = await Helpers.resolveObjects(resolved.id);
			// local create activities are assumed to come from the user who created the underlying object
			const actor = object.attributedTo || object.actor;
			return {
				'@context': 'https://www.w3.org/ns/activitystreams',
				actor,
				id,
				type: 'Create',
				object,
			};
		}
		default: {
			throw new Error('[[error:activitypub.not-implemented]]');
		}
	}
};

Helpers.mapToLocalType = (type) => {
	if (type === 'Person') {
		return 'user';
	}
	if (type === 'Group') {
		return 'category';
	}
	if (type === 'Hashtag') {
		return 'tag';
	}
	if (activitypub._constants.acceptedPostTypes.includes(type)) {
		return 'post';
	}
};

Helpers.resolveObjects = async (ids) => {
	if (!Array.isArray(ids)) {
		ids = [ids];
	}
	const objects = await Promise.all(ids.map(async (id) => {
		// try to get a local ID first
		const { type, id: resolvedId, activity, data: activityData } = await Helpers.resolveLocalId(id);
		// activity data is only resolved for local IDs - so this will be false for remote posts
		if (activity) {
			return Helpers.resolveActivity(activity, activityData, id, { type, id: resolvedId });
		}
		switch (type) {
			case 'user': {
				if (!await user.exists(resolvedId)) {
					throw new Error('[[error:activitypub.invalid-id]]');
				}
				return activitypub.mocks.actors.user(resolvedId);
			}

			case 'post': {
				const post = (await posts.getPostSummaryByPids(
					[resolvedId],
					activitypub._constants.uid,
					{
						stripTags: false,
						extraFields: ['edited'],
					}
				)).pop();
				if (!post) {
					throw new Error('[[error:activitypub.invalid-id]]');
				}
				return activitypub.mocks.notes.public(post);
			}

			case 'category': {
				if (!await categories.exists(resolvedId)) {
					throw new Error('[[error:activitypub.invalid-id]]');
				}
				return activitypub.mocks.actors.category(resolvedId);
			}

			case 'message': {
				if (!await messaging.messageExists(resolvedId)) {
					throw new Error('[[error:activitypub.invalid-id]]');
				}
				const messageObj = await messaging.getMessageFields(resolvedId, []);
				messageObj.content = await messaging.parse(messageObj.content, messageObj.fromuid, 0, messageObj.roomId, false);
				return activitypub.mocks.notes.private({ messageObj });
			}

			// if the type is not recognized, assume it's not a local ID and fetch the object from its origin
			default: {
				return activitypub.get('uid', 0, id);
			}
		}
	}));
	return objects.length === 1 ? objects[0] : objects;
};

Helpers.generateTitle = (html) => {
	// Given an html string, generates a more appropriate title if possible
	const prettified = pretty(html);

	// Remove any lines that contain quote-post fallbacks
	const cleaned = prettified.split('\n').filter(line => !line.startsWith('<p class="quote-inline"')).join('\n');
	const sentences = tokenizer.sentences(cleaned, { sanitize: true, newline_boundaries: true });
	let title = sentences.shift();

	// Truncate down if too long
	if (title.length > meta.config.maximumTitleLength) {
		title = `${title.slice(0, meta.config.maximumTitleLength - 3)}...`;
	}

	return title;
};


Helpers.remoteAnchorToLocalProfile = async (content, isMarkdown = false) => {
	let anchorRegex;
	if (isMarkdown) {
		anchorRegex = /\[(.*?)\]\((.+?)\)/ig;
	} else {
		anchorRegex = /<a.*?href=['"](.+?)['"].*?>(.*?)<\/a>/ig;
	}

	const anchors = content.matchAll(anchorRegex);
	const urls = new Set();
	const matches = [];
	for (const anchor of anchors) {
		let match;
		let url;
		if (isMarkdown) {
			[match,, url] = anchor;
		} else {
			[match, url] = anchor;
		}
		matches.push([match, url]);
		urls.add(url);
	}

	if (!urls.size) {
		return content;
	}

	const urlMap = new Map();
	const urlsArray = Array.from(urls);

	// Local references
	const localUrls = urlsArray.filter(url => url.startsWith(nconf.get('url')));
	await Promise.all(localUrls.map(async (url) => {
		const { type, id } = await Helpers.resolveLocalId(url);
		if (type === 'user') {
			urlMap.set(url, id);
		} // else if (type === 'category') {
	}));

	// Remote references
	const [backrefs, urlAsIdExists] = await Promise.all([
		db.getObjectFields('remoteUrl:uid', urlsArray),
		db.isSortedSetMembers('usersRemote:lastCrawled', urlsArray),
	]);
	urlsArray.forEach((url, index) => {
		if (backrefs[url] || urlAsIdExists[index]) {
			urlMap.set(url, backrefs[url] || url);
		}
	});

	let slugs = await user.getUsersFields(Array.from(urlMap.values()), ['userslug']);
	slugs = slugs.map(({ userslug }) => userslug);
	Array.from(urlMap.keys()).forEach((url, idx) => {
		urlMap.set(url, `/user/${encodeURIComponent(slugs[idx])}`);
	});

	// Modify existing anchors to local profile
	matches.forEach(([match, href]) => {
		const replacementHref = urlMap.get(href);
		if (replacementHref) {
			const replacement = match.replace(href, replacementHref);
			content = content.split(match).join(replacement);
		}
	});

	return content;
};

Helpers.makeSet = (object, properties) => new Set(properties.reduce((memo, property) =>
	memo.concat(object[property] ?
		Array.isArray(object[property]) ?
			object[property] :
			[object[property]] :
		[]), []));

Helpers.generateCollection = async ({ set, method, count, page, perPage, url }) => {
	if (!method) {
		method = db.getSortedSetRange.bind(null, set);
	} else if (set) {
		method = method.bind(null, set);
	}
	count = count ?? await db.sortedSetCard(set);
	const pageCount = Math.max(1, Math.ceil(count / perPage));
	let items = [];
	let paginate = true;

	if (!page && pageCount === 1) {
		page = 1;
		paginate = false;
	}

	page = parseInt(page, 10) || 1;
	page = Math.max(1, Math.min(page, pageCount));
	if (page) {
		const start = Math.max(0, (page - 1) * perPage);
		const stop = Math.max(0, start + perPage - 1);
		items = await method.call(null, start, stop);
	}

	return Helpers.generateCollectionFromItems({
		items,
		count,
		page,
		perPage,
		url,
		paginate,
	});
};

Helpers.generateCollectionFromItems = async ({ items, count, page, perPage, url, paginate }) => {
	const pageCount = Math.max(1, Math.ceil(count / perPage));
	const object = {
		type: paginate && items.length ? 'OrderedCollectionPage' : 'OrderedCollection',
		totalItems: count,
	};

	if (items.length) {
		object.orderedItems = items;

		if (paginate) {
			object.partOf = url;
			object.next = page < pageCount ? `${url}?page=${page + 1}` : null;
			object.prev = page > 1 ? `${url}?page=${page - 1}` : null;
		}
	}

	if (paginate) {
		object.first = `${url}?page=1`;
		object.last = `${url}?page=${pageCount}`;
	}

	return object;
};

Helpers.generateDigest = (set) => {
	if (!(set instanceof Set)) {
		throw new Error('[[error:invalid-data]]');
	}

	return Array
		.from(set)
		.map(item => sha256(item))
		.reduce((memo, cur) => {
			const a = Buffer.from(memo, 'hex');
			const b = Buffer.from(cur, 'hex');
			// eslint-disable-next-line no-bitwise
			const result = a.map((x, i) => x ^ b[i]);
			return result.toString('hex');
		});
};

Helpers.addressed = (id, activity) => {
	// Returns Boolean for if id is found in addressing fields (to, cc, etc.)
	if (!id || !activity || typeof activity !== 'object') {
		return false;
	}

	const combined = new Set([
		...(activity.to || []),
		...(activity.cc || []),
		...(activity.bto || []),
		...(activity.bcc || []),
		...(activity.audience || []),
	]);

	return combined.has(id);
};

Helpers.renderEmoji = (text, tags, strip = false) => {
	if (!text || !tags) {
		return text;
	}

	tags = Array.isArray(tags) ? tags : [tags];
	let result = text;

	const parsed = new Set();
	tags.forEach((tag) => {
		const isEmoji = tag.type === 'Emoji';
		const hasUrl = tag.icon && tag.icon.url;
		const isImage = !tag.icon?.mediaType || tag.icon.mediaType.startsWith('image/');

		if (isEmoji && (strip || (hasUrl && isImage))) {
			if (!Helpers.isUri(tag.icon.url)) {
				return;
			}

			let { name } = tag;
			if (parsed.has(name)) {
				return;
			}

			if (!name.startsWith(':')) {
				name = `:${name}`;
			}
			if (!name.endsWith(':')) {
				name = `${name}:`;
			}

			const imgTag = strip ?
				'' :
				`<img class="not-responsive emoji" src="${tag.icon.url}" title="${name}" />`;

			let index = result.indexOf(name);
			while (index !== -1) {
				result = result.substring(0, index) + imgTag + result.substring(index + name.length);
				index = result.indexOf(name, index + imgTag.length);
			}
			parsed.add(name);
		}
	});

	return result;
};
