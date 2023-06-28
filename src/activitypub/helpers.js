'use strict';

const request = require('request-promise-native');
const { generateKeyPairSync } = require('crypto');
const winston = require('winston');
const nconf = require('nconf');

const db = require('../database');
const ttl = require('../cache/ttl');
const user = require('../user');

const webfingerCache = ttl({ ttl: 1000 * 60 * 60 * 24 }); // 24 hours

const Helpers = module.exports;

Helpers.query = async (id) => {
	const [username, hostname] = id.split('@');
	if (!username || !hostname) {
		return false;
	}

	if (webfingerCache.has(id)) {
		return webfingerCache.get(id);
	}

	// Make a webfinger query to retrieve routing information
	const response = await request(`https://${hostname}/.well-known/webfinger?resource=acct:${id}`, {
		simple: false,
		resolveWithFullResponse: true,
		json: true,
	});

	if (response.statusCode !== 200 || !response.body.hasOwnProperty('links')) {
		return false;
	}

	// Parse links to find actor endpoint
	let actorUri = response.body.links.filter(link => link.type === 'application/activity+json' && link.rel === 'self');
	if (actorUri.length) {
		actorUri = actorUri.pop();
		({ href: actorUri } = actorUri);
	}

	const { publicKey } = response.body;

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

Helpers.resolveLocalUid = async (id) => {
	const [slug, host] = id.split('@');

	if (id.indexOf('@') === -1 || host !== nconf.get('url_parsed').host) {
		throw new Error('[[activitypub:invalid-id]]');
	}

	return await user.getUidByUserslug(slug);
};
