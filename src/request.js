'use strict';

const nconf = require('nconf');
const { CookieJar } = require('tough-cookie');
const fetchCookie = require('fetch-cookie').default;
const { version } = require('../package.json');
const { Agent } = require('undici');
const { Dispatcher1Wrapper } = require('undici');

const plugins = require('./plugins');
const { checkHostname, lookup, allowList } = require('./ssrf');

let initialized = false;

exports.jar = function () {
	return new CookieJar();
};

const userAgent = `NodeBB/${version.split('.').shift()}.x (${nconf.get('url')})`;

async function init() {
	if (initialized) {
		return;
	}

	allowList.add(nconf.get('url_parsed').hostname);
	const { allowed } = await plugins.hooks.fire('filter:request.init', { allowed: allowList });
	if (allowed instanceof Set) {
		// Replace the set reference — ssrf.js uses this same Set
		allowList.clear();
		allowed.forEach(h => allowList.add(h));
	}
	// Always ensure the configured URL's hostname is in the allow list
	allowList.add(nconf.get('url_parsed').hostname);
	initialized = true;
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

// Connection pool sizing — prevents the event loop from being flooded when
// ActivityPub or other code fires many concurrent outbound requests.
// These values are kept conservative because the bottleneck is I/O callback
// processing in the single-threaded event loop, not CPU throughput.
// ActivityPub batches scale with CPU count independently, so maxSockets
// acts as a hard cap that forces queuing rather than thundering herd.
const maxSockets = 64; // total sockets across all hosts
const maxConnections = 256; // allow connection reuse above maxSockets
const connectionsPerHost = 10; // per-server connection limit

const dispatcher = new NodeBBAgent({
	maxSockets,
	maxConnections,
	connections: connectionsPerHost,
	allowH2: true,
	pipelining: 1,
	connect: {
		lookup,
		rejectUnauthorized: !isDevOrTest,
	},
});
const manualDispatcher = new Dispatcher1Wrapper(dispatcher);

async function call(url, method, { body, timeout, jar, sizeLimit = 10 * 1024 * 1024, ...config } = {}) {
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
			size: sizeLimit,
			dispatcher: manualDispatcher,
		};
		if (body instanceof FormData) {
			// If body is FormData, let fetch handle the content-type header
			delete opts.headers['content-type'];
		}

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
			redirectCount += 1;
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

		let buffer;
		try {
			buffer = await response.arrayBuffer();
		} catch (err) {
			// undici throws TypeError when streaming size is exceeded; rethrow
			if (err.name === 'TypeError' && String(err.message).includes('exceeded')) {
				throw new Error(`Response size exceeded limit (${sizeLimit} bytes)`);
			}
			throw err;
		}
		if (buffer.byteLength > sizeLimit) {
			throw new Error(`Response size (${buffer.byteLength} bytes) exceeds limit (${sizeLimit} bytes)`);
		}

		let respBody = new TextDecoder().decode(buffer);

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
			url: currentUrl,
		};
	}

	throw new Error(`Maximum redirects (${maxRedirects}) exceeded`);
}

// Checks url to ensure it is not in reserved IP range (private, etc.)
// Wraps ssrf.checkHostname with the plugin allow-list for extensibility.
async function check(url) {
	const { hostname } = new URL(url);
	await init();

	if (allowList.has(hostname)) {
		return { ok: true };
	}

	return await checkHostname(hostname);
}

/*
const { body, response } = await request.get('someurl?foo=1&baz=2')
*/
exports.check = check;

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
