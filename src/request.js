'use strict';

const axios = require('axios').default;
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

wrapper(axios);

exports.jar = function () {
	return new CookieJar();
};

async function call(url, method, config = {}) {
	const result = await axios({
		...config,
		method,
		url: url,
	});

	return {
		body: result.data,
		response: {
			status: result.status,
			statusCode: result.status,
			statusText: result.statusText,
			headers: result.headers,
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


