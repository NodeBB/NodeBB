'use strict';

const { CookieJar } = require('tough-cookie');
const fetchCookie = require('fetch-cookie');

exports.jar = function () {
	return new CookieJar();
};

async function call(url, method, { body, timeout, ...config } = {}) {
	let fetchImpl = fetch;
	if (config.jar) {
		fetchImpl = fetchCookie(fetch, config.jar);
	}

	const opts = {
		...config,
		method: method.toUpperCase(), // patch=>PATCH
		headers: {
			'content-type': 'application/json',
			...config.headers,
		},
	};
	if (timeout > 0) {
		opts.signal = AbortSignal.timeout(timeout);
	}

	if (body && ['post', 'put', 'patch', 'del', 'delete'].includes(method)) {
		if (opts.headers['content-type'] && opts.headers['content-type'].startsWith('application/json')) {
			opts.body = JSON.stringify(body);
		} else {
			opts.body = body;
		}
	}

	const response = await fetchImpl(url, opts);

	const { headers } = response;
	const contentType = headers.get('content-type');
	const isJSON = contentType && contentType.indexOf('application/json') !== -1;
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

/*
const { body, response } = await request.get('someurl?foo=1&baz=2')
or
const { body, response } = await request.get('someurl', { params: { foo:1, baz: 2 } })
*/
exports.get = async (url, config) => call(url, 'get', config);

exports.head = async (url, config) => call(url, 'head', config);
exports.del = async (url, config) => call(url, 'delete', config);
exports.delete = exports.del;
exports.options = async (url, config) => call(url, 'delete', config);

/*
const { body, response } = await request.post('someurl', { data: { foo: 1, baz: 2}})
*/
exports.post = async (url, config) => call(url, 'post', config);
exports.put = async (url, config) => call(url, 'put', config);
exports.patch = async (url, config) => call(url, 'patch', config);


