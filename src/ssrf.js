'use strict';

const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');

const checkCache = new Map();
const CHECK_TTL = 1000 * 60 * 60; // 1 hour
const CHECK_CLEANUP_INTERVAL = 1000 * 60 * 5; // 5 minutes

const cleanupInterval = setInterval(() => {
	const now = Date.now();
	for (const [hostname, cached] of checkCache) {
		if (now - (cached._ts || 0) >= CHECK_TTL) {
			checkCache.delete(hostname);
		}
	}
}, CHECK_CLEANUP_INTERVAL);
cleanupInterval.unref();

async function checkHostname(rawHostname) {
	const hostname = rawHostname.replace(/^\[|\]$/g, '');
	const cached = checkCache.get(hostname);
	if (cached && (Date.now() - (cached._ts || 0)) < CHECK_TTL) {
		return cached;
	}

	if (ipaddr.isValid(hostname)) {
		const parsed = ipaddr.parse(hostname);
		const ok = parsed.range() === 'unicast';
		const payload = { ok, _ts: Date.now() };
		checkCache.set(hostname, payload);
		return payload;
	}

	try {
		const lookupResults = await dns.lookup(hostname, { all: true });
		if (!lookupResults.length) {
			return { ok: false, _ts: Date.now() };
		}

		const ok = lookupResults.every(({ address }) => ipaddr.parse(address).range() === 'unicast');
		const payload = { ok, lookup: lookupResults, _ts: Date.now() };
		checkCache.set(hostname, payload);
		return payload;
	} catch (err) {
		return { ok: false, _ts: Date.now() };
	}
}

async function check(url) {
	const { hostname } = new URL(url);
	return await checkHostname(hostname);
}

async function lookup(hostname, options, callback) {
	let lookupResult = checkCache.get(hostname);
	if (!lookupResult) {
		lookupResult = await checkHostname(hostname);
	}

	let { ok, lookup: addresses } = lookupResult;
	addresses = addresses && [...addresses];

	if (!ok) {
		callback(new Error('lookup-failed'));
		return;
	}

	if (!addresses) {
		dns.lookup(hostname, options).then(res => callback(null, res)).catch(callback);
		return;
	}

	process.nextTick(() => {
		if (options.all === true) {
			callback(null, addresses);
		} else {
			const { address, family } = addresses.shift();
			callback(null, address, family);
		}
	});
}

module.exports = {
	checkHostname,
	check,
	lookup,
};
