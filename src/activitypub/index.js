'use strict';

const { generateKeyPairSync } = require('crypto');

const winston = require('winston');
const request = require('request-promise-native');

const db = require('../database');
const helpers = require('./helpers');

const ActivityPub = module.exports;

ActivityPub.getActor = async (id) => {
	const { hostname, actorUri: uri } = await helpers.query(id);
	if (!uri) {
		return false;
	}

	const actor = await request({
		uri,
		headers: {
			Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
		},
		json: true,
	});

	actor.hostname = hostname;

	return actor;
};

ActivityPub.getPublicKey = async (uid) => {
	let publicKey;

	try {
		({ publicKey } = await db.getObject(`uid:${uid}:keys`));
	} catch (e) {
		({ publicKey } = await generateKeys(uid));
	}

	return publicKey;
};

async function generateKeys(uid) {
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
}
