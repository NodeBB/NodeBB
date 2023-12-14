'use strict';

const request = require('request-promise-native');
const nconf = require('nconf');
const { createHash, createSign, createVerify } = require('crypto');
const validator = require('validator');

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
	if (validator.isURL(input, {
		require_protocol: true,
		require_host: true,
		protocols: ['https'],
		require_valid_protocol: true,
	})) {
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

	const actor = await request({
		uri,
		headers: {
			Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
		},
		json: true,
	});

	actor.hostname = new URL(uri).hostname;

	actorCache.set(uri, actor);
	return actor;
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
	const { publicKey } = await request({
		uri,
		headers: {
			Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
		},
		json: true,
	});

	return publicKey;
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
	const signatureHash = createHash('sha256');
	signatureHash.update(signed_string);
	const signatureDigest = signatureHash.digest('hex');
	let signature = createSign('sha256');
	signature.update(signatureDigest);
	signature.end();
	signature = signature.sign(key, 'hex');
	signature = btoa(signature);

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
		const signatureHash = createHash('sha256');
		signatureHash.update(signed_string);
		const signatureDigest = signatureHash.digest('hex');
		const verify = createVerify('sha256');
		verify.update(signatureDigest);
		verify.end();
		const verified = verify.verify(publicKeyPem, atob(signature), 'hex');
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
		actor: {
			type: 'Person',
			name: `${userslug}@${nconf.get('url_parsed').host}`,
		},
		...payload,
	};

	await Promise.all(inboxes.map(async (uri) => {
		const { date, digest, signature } = await ActivityPub.sign(uid, uri, payload);

		const response = await request(uri, {
			method: 'post',
			headers: {
				date,
				digest,
				signature,
				'content-type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
				accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
			},
			json: true,
			body: payload,
			simple: false,
			resolveWithFullResponse: true,
		});

		if (response.statusCode !== 201) {
			// todo: i18n this
			throw new Error('activity-failed');
		}
	}));
};
