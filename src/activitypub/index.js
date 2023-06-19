'use strict';

const request = require('request-promise-native');
const url = require('url');
const nconf = require('nconf');
const { createHash, createSign, createVerify } = require('crypto');

const db = require('../database');
const user = require('../user');

const ActivityPub = module.exports;

ActivityPub.helpers = require('./helpers');

ActivityPub.getActor = async (id) => {
	const { hostname, actorUri: uri } = await ActivityPub.helpers.query(id);
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
		digest = payloadHash.digest('hex');
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
			memo.push(`${cur}: ${String(req.method).toLowerCase()} ${req.path}`);
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

/**
 * This is just some code to test signing and verification. This should really be in the test suite.
 */
// setTimeout(async () => {
// 	const payload = {
// 		foo: 'bar',
// 	};
// 	const signature = await ActivityPub.sign(1, 'http://127.0.0.1:4567/user/julian/inbox', payload);

// 	const res = await request({
// 		uri: 'http://127.0.0.1:4567/user/julian/inbox',
// 		method: 'post',
// 		headers: {
// 			Accept: 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
// 			...signature,
// 		},
// 		json: true,
// 		body: payload,
// 		simple: false,
// 	});

// 	console.log(res);
// }, 1000);
