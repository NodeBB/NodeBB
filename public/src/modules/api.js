'use strict';

import { fire as fireHook } from 'hooks';
import { confirm } from 'bootbox';

const baseUrl = config.relative_path + '/api/v3';

async function call(options, callback) {
	options.url = options.url.startsWith('/api') ?
		config.relative_path + options.url :
		baseUrl + options.url;

	if (typeof callback === 'function') {
		xhr(options).then(result => callback(null, result), err => callback(err));
		return;
	}

	try {
		const result = await xhr(options);
		return result;
	} catch (err) {
		if (err.message === 'A valid login session was not found. Please log in and try again.') {
			const { url } = await fireHook('filter:admin.reauth', { url: 'login' });
			return confirm('[[error:api.reauth-required]]', (ok) => {
				if (ok) {
					ajaxify.go(url);
				}
			});
		}
		throw err;
	}
}

async function xhr(options) {
	// Normalize body based on type
	const { url } = options;
	delete options.url;

	if (options.data && !(options.data instanceof FormData)) {
		options.data = JSON.stringify(options.data || {});
		options.headers['content-type'] = 'application/json; charset=utf-8';
	}

	// Allow options to be modified by plugins, etc.
	({ options } = await fireHook('filter:api.options', { options }));

	/**
	 * Note: pre-v4 backwards compatibility
	 *
	 * This module now passes in "data" to xhr().
	 * This is because the "filter:api.options" hook (and plugins using it) expect "data".
	 * fetch() expects body, so we rename it here.
	 *
	 * In v4, replace all instances of "data" with "body" and record as breaking change.
	 */
	if (options.data) {
		options.body = options.data;
		delete options.data;
	}

	const res = await fetch(url, options);
	const { headers } = res;

	if (headers.get('x-redirect')) {
		return xhr({ url: headers.get('x-redirect'), ...options });
	}

	const contentType = headers.get('content-type');
	const isJSON = contentType && contentType.startsWith('application/json');

	let response;
	if (options.method !== 'HEAD') {
		if (isJSON) {
			response = await res.json();
		} else {
			response = await res.text();
		}
	}

	if (!res.ok) {
		if (response) {
			throw new Error(isJSON ? response.status.message : response);
		}
		throw new Error(res.statusText);
	}

	return isJSON && response && response.hasOwnProperty('status') && response.hasOwnProperty('response') ?
		response.response :
		response;
}

export function get(route, data, onSuccess) {
	return call({
		url: route + (data && Object.keys(data).length ? ('?' + $.param(data)) : ''),
	}, onSuccess);
}

export function head(route, data, onSuccess) {
	return call({
		url: route + (data && Object.keys(data).length ? ('?' + $.param(data)) : ''),
		method: 'HEAD',
	}, onSuccess);
}

export function post(route, data, onSuccess) {
	return call({
		url: route,
		method: 'POST',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function patch(route, data, onSuccess) {
	return call({
		url: route,
		method: 'PATCH',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function put(route, data, onSuccess) {
	return call({
		url: route,
		method: 'PUT',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function del(route, data, onSuccess) {
	return call({
		url: route,
		method: 'DELETE',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}
