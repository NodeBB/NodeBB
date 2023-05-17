'use strict';

const { generateKeyPairSync } = require('crypto');

const winston = require('winston');

const db = require('./database');

const ActivityPub = module.exports;

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
	winston.info(`[activitypub] Generating RSA key-pair for uid ${uid}`);
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
