'use strict';

const dns = require('dns').promises;

const nconf = require('nconf');
const ipaddr = require('ipaddr.js');
const { CookieJar } = require('tough-cookie');
const fetchCookie = require('fetch-cookie').default;
const { version } = require('../package.json');

const ttl = require('./cache/ttl');
const checkCache = ttl({
	ttl: 1000 * 60 * 60, // 1 hour
});

exports.jar = function () {
	return new CookieJar();
};

const userAgent = `NodeBB/${version.split('.').shift()}.x (${nconf.get('url')})`;

// Initialize fetch - somewhat hacky, but it's required for globalDispatcher to be available
async function call(url, method, { body, timeout, jar, ...config } = {}) {
	const ok = await check(url);
	if (!ok) {
		throw new Error('[[error:reserved-ip-address]]');
	}

	let fetchImpl = fetch;
	if (jar) {
		fetchImpl = fetchCookie(fetch, jar);
	}
	const jsonTest = /application\/([a-z]+\+)?json/;
	const opts = {
		...config,
		method,
		headers: {
			'content-type': 'application/json',
			'user-agent': userAgent,
			...config.headers,
		},
	};
	if (timeout > 0) {
		opts.signal = AbortSignal.timeout(timeout);
	}

	if (body && ['POST', 'PUT', 'PATCH', 'DEL', 'DELETE'].includes(method)) {
		if (opts.headers['content-type'] && jsonTest.test(opts.headers['content-type'])) {
			opts.body = JSON.stringify(body);
		} else {
			opts.body = body;
		}
	}
	// Workaround for https://github.com/nodejs/undici/issues/1305
	if (global[Symbol.for('undici.globalDispatcher.1')] !== undefined) {
		class FetchAgent extends global[Symbol.for('undici.globalDispatcher.1')].constructor {
			dispatch(opts, handler) {
				delete opts.headers['sec-fetch-mode'];
				return super.dispatch(opts, handler);
			}
		}
		opts.dispatcher = new FetchAgent();
	}

	const response = await fetchImpl(url, opts);

	const { headers } = response;
	const contentType = headers.get('content-type');
	const isJSON = contentType && jsonTest.test(contentType);
	let respBody = await response.text();
	if (isJSON && respBody) {
		try {
			respBody = JSON.parse(respBody);
		} catch (err) {
			throw new Error('invalid json in response body', url);
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

// Checks url to ensure it is not in reserved IP range (private, etc.)
async function check(url) {
	const cached = checkCache.get(url);
	if (cached) {
		return cached;
	}

	const addresses = new Set();
	if (ipaddr.isValid(url)) {
		addresses.add(url);
	} else {
		const { host } = new URL(url);
		const [v4, v6] = await Promise.all([
			dns.resolve4(host),
			dns.resolve6(host),
		]);
		v4.forEach((ip) => {
			addresses.add(ip);
		});
		v6.forEach((ip) => {
			addresses.add(ip);
		});
	}

	// Every IP address that the host resolves to should be a unicast address
	const ok = Array.from(addresses).every((ip) => {
		const parsed = ipaddr.parse(ip);
		return parsed.range() === 'unicast';
	});

	checkCache.set(url, ok);
	return ok;
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


