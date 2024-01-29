'use strict';

const { generateKeyPairSync } = require('crypto');
const winston = require('winston');
const nconf = require('nconf');
const validator = require('validator');

const request = require('../request');
const db = require('../database');
const ttl = require('../cache/ttl');
const user = require('../user');

const webfingerCache = ttl({ ttl: 1000 * 60 * 60 * 24 }); // 24 hours

const Helpers = module.exports;

Helpers.isUri = (value) => {
	if (typeof value !== 'string') {
		value = String(value);
	}

	const protocols = ['https'];
	if (process.env.CI === 'true') {
		protocols.push('http');
	}

	return validator.isURL(value, {
		require_protocol: true,
		require_host: true,
		protocols,
		require_valid_protocol: true,
		require_tld: false, // temporary — for localhost
	});
};

Helpers.query = async (id) => {
	const [username, hostname] = id.split('@');
	if (!username || !hostname) {
		return false;
	}

	if (webfingerCache.has(id)) {
		return webfingerCache.get(id);
	}

	// Make a webfinger query to retrieve routing information
	const { response, body } = await request.get(`https://${hostname}/.well-known/webfinger?resource=acct:${id}`);

	if (response.statusCode !== 200 || !body.hasOwnProperty('links')) {
		return false;
	}

	// Parse links to find actor endpoint
	let actorUri = body.links.filter(link => link.type === 'application/activity+json' && link.rel === 'self');
	if (actorUri.length) {
		actorUri = actorUri.pop();
		({ href: actorUri } = actorUri);
	}

	const { publicKey } = body;

	webfingerCache.set(id, { username, hostname, actorUri, publicKey });
	return { username, hostname, actorUri, publicKey };
};

Helpers.generateKeys = async (uid) => {
	winston.verbose(`[activitypub] Generating RSA key-pair for uid ${uid}`);
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

	await db.setObject(`uid:${uid}:keys`, { publicKey, privateKey });
	return { publicKey, privateKey };
};

Helpers.resolveLocalUid = async (input) => {
	let slug;
	const protocols = ['https'];
	if (process.env.CI === 'true') {
		protocols.push('http');
	}
	if (Helpers.isUri(input)) {
		const { host, pathname } = new URL(input);

		if (host === nconf.get('url_parsed').host) {
			const [type, value] = pathname.replace(nconf.get('relative_path'), '').split('/').filter(Boolean)[1];
			if (type === 'uid') {
				return value;
			}

			slug = value;
		} else {
			throw new Error('[[error:activitypub.invalid-id]]');
		}
	} else if (input.indexOf('@') !== -1) { // Webfinger
		([slug] = input.replace(/^acct:/, '').split('@'));
	} else {
		throw new Error('[[error:activitypub.invalid-id]]');
	}

	return await user.getUidByUserslug(slug);
};
