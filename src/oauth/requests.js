'use strict';

const { randomBytes } = require('crypto');
const db = require('../database');

const Requests = module.exports;

// RFC 9126 request_uri: a by-reference authorization request created by this
// instance, valid for a short window.
Requests.TTL = 300; // seconds

Requests.key = id => `oauth:request:${id}`;

Requests.create = async ({ params, uid }) => {
	const id = randomBytes(16).toString('hex');
	await db.setObject(Requests.key(id), {
		params: JSON.stringify(params || {}),
		uid: uid || 0,
		created: Date.now(),
	});
	await db.pexpire(Requests.key(id), Requests.TTL * 1000);
	return id;
};

Requests.get = async (id) => {
	if (!id) {
		return null;
	}

	const data = await db.getObject(Requests.key(id));
	if (!data) {
		return null;
	}

	let params;
	try {
		params = JSON.parse(data.params || '{}');
	} catch (e) {
		return null;
	}

	return { id, params, uid: parseInt(data.uid, 10) || 0 };
};

Requests.remove = async (id) => {
	await db.delete(Requests.key(id));
};
