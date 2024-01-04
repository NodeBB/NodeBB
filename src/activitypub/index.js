'use strict';

const nconf = require('nconf');
const { createHash, createSign, createVerify } = require('crypto');
const validator = require('validator');

const request = require('../request');
const db = require('../database');
const user = require('../user');
const ttl = require('../cache/ttl');

const actorCache = ttl({ ttl: 1000 * 60 * 60 * 24 }); // 24 hours
const ActivityPub = module.exports;

ActivityPub.helpers = require('./helpers');
ActivityPub.inbox = require('./inbox');

ActivityPub.getActor = async (input) => {
	// Can be a webfinger id, uri, or object, handle as appropriate
	let uri;
	if (ActivityPub.helpers.isUri(input)) {
		uri = input;
	} else if (input.indexOf('@') !== -1) { // Webfinger
		({ actorUri: uri } = await ActivityPub.helpers.query(input));
	} else {
		throw new Error('[[error:invalid-data]]');
	}

	if (!uri) {
		throw new Error('[[error:invalid-uid]]');
	}

	if (actorCache.has(uri)) {
		return actorCache.get(uri);
	}

	const { body: actor } = await request.get(uri, {
		headers: {
			Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
		},
	});

	actor.hostname = new URL(uri).hostname;

	actorCache.set(uri, actor);
	return actor;
};

ActivityPub.mockProfile = async (actors, callerUid = 0) => {
	// Accepts an array containing actor objects (the output of getActor()), or uris
	let single = false;
	if (!Array.isArray(actors)) {
		single = true;
		actors = [actors];
	}

	const profiles = await Promise.all(actors.map(async (actor) => {
		// convert uri to actor object
		if (typeof actor === 'string' && ActivityPub.helpers.isUri(actor)) {
			actor = await ActivityPub.getActor(actor);
		}

		const uid = actor.id;
		const { preferredUsername, published, icon, image, name, summary, hostname } = actor;
		const isFollowing = await db.isSortedSetMember(`followingRemote:${callerUid}`, uid);

		let picture;
		if (icon) {
			picture = typeof icon === 'string' ? icon : icon.url;
		}
		const iconBackgrounds = await user.getIconBackgrounds();
		let bgColor = Array.prototype.reduce.call(preferredUsername, (cur, next) => cur + next.charCodeAt(), 0);
		bgColor = iconBackgrounds[bgColor % iconBackgrounds.length];

		const payload = {
			uid,
			username: `${preferredUsername}@${hostname}`,
			userslug: `${preferredUsername}@${hostname}`,
			fullname: name,
			joindate: new Date(published).getTime(),
			picture,
			'icon:text': (preferredUsername[0] || '').toUpperCase(),
			'icon:bgColor': bgColor,
			uploadedpicture: undefined,
			'cover:url': !image || typeof image === 'string' ? image : image.url,
			'cover:position': '50% 50%',
			aboutme: summary,
			aboutmeParsed: summary,

			isFollowing,
		};

		return payload;
	}));

	return single ? profiles.pop() : profiles;
};

ActivityPub.resolveInboxes = async ids => await Promise.all(ids.map(async (id) => {
	const actor = await ActivityPub.getActor(id);
	return actor.inbox;
}));

ActivityPub.getPublicKey = async (uid) => {
	let publicKey;

	try {
		({ publicKey } = await db.getObject(`uid:${uid}:keys`));
	} catch (e) {
		({ publicKey } = await ActivityPub.helpers.generateKeys(uid));
	}

	return publicKey;
};

ActivityPub.getPrivateKey = async (uid) => {
	let privateKey;

	try {
		({ privateKey } = await db.getObject(`uid:${uid}:keys`));
	} catch (e) {
		({ privateKey } = await ActivityPub.helpers.generateKeys(uid));
	}

	return privateKey;
};

ActivityPub.fetchPublicKey = async (uri) => {
	// Used for retrieving the public key from the passed-in keyId uri
	const { body } = await request.get(uri, {
		headers: {
			Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
		},
	});

	return body.publicKey;
};

ActivityPub.sign = async (uid, url, payload) => {
	// Returns string for use in 'Signature' header
	const { host, pathname } = new URL(url);
	const date = new Date().toUTCString();
	const key = await ActivityPub.getPrivateKey(uid);
	const userslug = await user.getUserField(uid, 'userslug');
	const keyId = `${nconf.get('url')}/user/${userslug}#key`;
	let digest = null;

	let headers = '(request-target) host date';
	let signed_string = `(request-target): ${payload ? 'post' : 'get'} ${pathname}\nhost: ${host}\ndate: ${date}`;

	// Calculate payload hash if payload present
	if (payload) {
		const payloadHash = createHash('sha256');
		payloadHash.update(JSON.stringify(payload));
		digest = `sha-256=${payloadHash.digest('base64')}`;
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
		signature: `keyId="${keyId}",headers="${headers}",signature="${signature}"`,
	};
};

ActivityPub.verify = async (req) => {
	// Break the signature apart
	const { keyId, headers, signature } = req.headers.signature.split(',').reduce((memo, cur) => {
		const split = cur.split('="');
		const key = split.shift();
		const value = split.join('="');
		memo[key] = value.slice(0, -1);
		return memo;
	}, {});

	// Retrieve public key from remote instance
	const { publicKeyPem } = await ActivityPub.fetchPublicKey(keyId);

	// Re-construct signature string
	const signed_string = headers.split(' ').reduce((memo, cur) => {
		if (cur === '(request-target)') {
			memo.push(`${cur}: ${String(req.method).toLowerCase()} ${req.baseUrl}${req.path}`);
		} else if (req.headers.hasOwnProperty(cur)) {
			memo.push(`${cur}: ${req.headers[cur]}`);
		}

		return memo;
	}, []).join('\n');

	// Verify the signature string via public key
	try {
		const verify = createVerify('sha256');
		verify.update(signed_string);
		verify.end();
		const verified = verify.verify(publicKeyPem, signature, 'base64');
		return verified;
	} catch (e) {
		return false;
	}
};

ActivityPub.send = async (uid, targets, payload) => {
	if (!Array.isArray(targets)) {
		targets = [targets];
	}

	const userslug = await user.getUserField(uid, 'userslug');
	const inboxes = await ActivityPub.resolveInboxes(targets);

	payload = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		actor: `${nconf.get('url')}/user/${userslug}`,
		...payload,
	};

	await Promise.all(inboxes.map(async (uri) => {
		const headers = await ActivityPub.sign(uid, uri, payload);
		const { response } = await request.post(uri, {
			headers: {
				...headers,
				'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			},
			body: payload,
		});

		if (!String(response.statusCode).startsWith('2')) {
			// todo: i18n this
			throw new Error('activity-failed');
		}
	}));
};
