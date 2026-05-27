'use strict';

const db = require('../../database');

const Intents = module.exports;

const activitypub = require('../../activitypub');

const helpers = require('../helpers');

const RATE_LIMIT_WINDOW = 5000; // 5 seconds

async function checkRateLimit(ip) {
	const key = `locks:intents:query:${ip}`;
	const exists = await db.exists(key);
	if (exists) {
		throw new Error('[[error:api.429]]');
	}
	await db.set(key, '1');
	await db.pexpire(key, RATE_LIMIT_WINDOW);
}

Intents.query = async (req, res) => {
	const ip = req.ip || req.connection.remoteAddress;
	await checkRateLimit(ip);

	let { handle } = req.params;
	handle = handle.trim().replace(/^@/, '');
	const webfinger = await activitypub.helpers.query(handle);

	// Parse out intents
	let intents = [];
	const prefix = 'https://w3id.org/fep/3b86/';
	if (!webfinger || !webfinger?._raw?.links) {
		helpers.formatApiResponse(200, res, { intents });
	}
	intents = webfinger._raw.links.reduce((memo, link) => {
		if (link.rel.startsWith(prefix)) {
			const intent = link.rel.slice(prefix.length).toLowerCase();
			memo[intent] = link.template;
		}
		return memo;
	}, {});
	helpers.formatApiResponse(200, res, { intents });
};