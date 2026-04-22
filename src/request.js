'use strict';

const dns = require('dns').promises;
const { Agent, setGlobalDispatcher } = require('undici');
const nconf = require('nconf');
const ipaddr = require('ipaddr.js');
const { CookieJar } = require('tough-cookie');
const fetchCookie = require('fetch-cookie').default;
const { version } = require('../package.json');

const plugins = require('./plugins');
const ttl = require('./cache/ttl');
const checkCache = ttl({
	name: 'request-check',
	max: 1000,
	ttl: 1000 * 60 * 60, // 1 hour
});
let allowList = new Set();
let initialized = false;

exports.jar = function () {
	return new CookieJar();
};

const userAgent = `NodeBB/${version.split('.').shift()}.x (${nconf.get('url')})`;

async function init() {
	if (initialized) {
		return;
	}

	allowList.add(nconf.get('url_parsed').host);
	const { allowed } = await plugins.hooks.fire('filter:request.init', { allowed: allowList });
	if (allowed instanceof Set) {
		allowList = allowed;
	}
	initialized = true;
}

/**
 * This method (alongside `check()`) guards against SSRF via DNS rebinding.
 *
 *  - `check()` does a DNS lookup and ensures that all returned IPs do not belong to a reserved IP address space
 *  - `lookup()` provides additional logic that uses the cached DNS result from `check()`
 *     instead of doing another lookup (which is where DNS rebinding comes into play.)
 *  - For whatever reason `undici` needs to be required so that lookup can be overwritten properly.
 */
function lookup(hostname, options, callback) {
	let { ok, lookup } = checkCache.get(hostname);
	lookup = lookup && [...lookup];
	if (!ok) {
		throw new Error('lookup-failed');
	}

	if (!lookup) {
		// trusted, do regular lookup
		dns.lookup(hostname, options).then((addresses) => {
			callback(null, addresses);
		}).catch((err) => {
			console.log('lookup error', err);
			callback(err);
		});
		return;
	}

	// Lookup needs to behave asynchronously — https://github.com/nodejs/node/issues/28664
	process.nextTick(() => {
		if (options.all === true) {
			callback(null, lookup);
		} else {
			const { address, family } = lookup.shift();
			callback(null, address, family);
		}
	});
}

class NodeBBAgent extends Agent {
	dispatch(opts, handler) {
		if (opts.headers) {
			delete opts.headers['sec-fetch-mode'];
		}
		return super.dispatch(opts, handler);
	}
}
const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.CI === 'true';
const dispatcher = new NodeBBAgent({
	connect: {
		lookup,
		rejectUnauthorized: !isDevOrTest,
	},
});

setGlobalDispatcher(dispatcher);

async function call(url, method, { body, timeout, jar, ...config } = {}) {
	const originalUrl = url;
	let currentUrl = url;
	let redirectCount = 0; // Add redirect counter
	const maxRedirects = 10; // Reasonable limit

	while (redirectCount <= maxRedirects) {
		// Check the current URL
		// eslint-disable-next-line no-await-in-loop
		const { ok } = await check(currentUrl);
		if (!ok) {
			throw new Error(`[[error:reserved-ip-address]] (URL: ${currentUrl})`);
		}

		let fetchImpl = fetch;
		if (jar) {
			fetchImpl = fetchCookie(fetch, jar);
		}

		const jsonTest = /application\/([a-z]+\+)?json/;
		const opts = {
			...config,
			method,
			redirect: 'manual',
			headers: {
				'content-type': 'application/json',
				'user-agent': userAgent,
				...config.headers,
			},
			signal: timeout > 0 ? AbortSignal.timeout(timeout) : undefined,
		};

		if (body && ['POST', 'PUT', 'PATCH', 'DEL', 'DELETE'].includes(method)) {
			if (opts.headers['content-type'] && jsonTest.test(opts.headers['content-type'])) {
				opts.body = JSON.stringify(body);
			} else {
				opts.body = body;
			}
		}

		// eslint-disable-next-line no-await-in-loop
		const response = await fetchImpl(currentUrl, opts);

		// Handle redirects
		if (config.redirect !== 'manual' && [301, 302, 307, 308].includes(response.status)) {
			redirectCount++;
			const location = response.headers.get('location');
			if (!location) break;

			try {
				currentUrl = new URL(location, currentUrl).href;
				continue;
			} catch (err) {
				throw new Error(`Invalid redirect URL: ${location}`);
			}
		}

		// Process final response
		const { headers } = response;
		const contentType = headers.get('content-type');
		const isJSON = contentType && jsonTest.test(contentType);
		// eslint-disable-next-line no-await-in-loop
		let respBody = await response.text();

		if (isJSON && respBody) {
			try {
				respBody = JSON.parse(respBody);
			} catch (err) {
				throw new Error(`invalid json in response body from ${originalUrl}`);
			}
		}

		return {
			body: respBody,
			response: {
				ok: response.ok,
				status: response.status,
				statusCode: response.status,
				statusText: response.statusText,
				headers: Object.fromEntries(response.headers.entries()),
			},
		};
	}

	throw new Error(`Maximum redirects (${maxRedirects}) exceeded`);
}

// Checks url to ensure it is not in reserved IP range (private, etc.)
async function check(url) {
	await init();

	const { host } = new URL(url);
	const cached = checkCache.get(url);
	if (cached !== undefined) {
		return cached;
	}
	if (allowList.has(host)) {
		const payload = { ok: true };
		checkCache.set(host, payload);
		return payload;
	}

	const addresses = new Set();
	let lookup;
	if (ipaddr.isValid(url)) {
		addresses.add(url);
	} else {
		lookup = await dns.lookup(host, { all: true });
		lookup.forEach(({ address, family }) => {
			addresses.add({ address, family });
		});
	}

	if (addresses.size < 1) {
		return { ok: false };
	}

	// Every IP address that the host resolves to should be a unicast address
	const ok = Array.from(addresses).every(({ address: ip }) => {
		const parsed = ipaddr.parse(ip);
		return parsed.range() === 'unicast';
	});

	const payload = { ok, lookup };
	checkCache.set(host, payload);
	return payload;
}

/*
const { body, response } = await request.get('someurl?foo=1&baz=2')
*/
exports.get = async (url, config) => call(url, 'GET', config);

exports.head = async (url, config) => call(url, 'HEAD', config);
exports.del = async (url, config) => call(url, 'DELETE', config);
exports.delete = exports.del;
exports.options = async (url, config) => call(url, 'OPTIONS', config);

/*
const { body, response } = await request.post('someurl', { body: { foo: 1, baz: 2}})
*/
exports.post = async (url, config) => call(url, 'POST', config);
exports.put = async (url, config) => call(url, 'PUT', config);
exports.patch = async (url, config) => call(url, 'PATCH', config);


