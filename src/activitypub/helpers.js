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

	const { subject, publicKey } = body;
	const payload = { subject, username, hostname, actorUri, publicKey };

	const claimedId = subject.slice(5);
	webfingerCache.set(claimedId, payload);
	if (claimedId !== id) {
		webfingerCache.set(id, payload);
	}

	return payload;
};

Helpers.generateKeys = async (type, id) => {
	winston.verbose(`[activitypub] Generating RSA key-pair for ${type} ${id}`);
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
		const { host, pathname } = new URL(input);

		if (host === nconf.get('url_parsed').host) {
			const [prefix, value] = pathname.replace(nconf.get('relative_path'), '').split('/').filter(Boolean);

			switch (prefix) {
				case 'uid':
					return { type: 'user', id: value };

				case 'post':
					return { type: 'post', id: value };

				case 'category':
					return { type: 'category', id: value };

				case 'user': {
					const uid = await user.getUidByUserslug(value);
					return { type: 'user', id: uid };
				}
			}

			return { type: null, id: null };
		}

		return { type: null, id: null };
	} else if (String(input).indexOf('@') !== -1) { // Webfinger
		const [slug] = input.replace(/^acct:/, '').split('@');
		const uid = await user.getUidByUserslug(slug);
		return { type: 'user', id: uid };
	}

	return { type: null, id: null };
};
