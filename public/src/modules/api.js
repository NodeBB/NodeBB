'use strict';

import { fire as fireHook } from 'hooks';
import { confirm } from 'modals';
import * as translator from 'translator';
import * as storage from 'storage';

const baseUrl = config.relative_path + '/api/v3';

async function call(options, callback) {
	options.url = options.url.startsWith('/api') ?
		config.relative_path + options.url :
		baseUrl + options.url;

	options.headers = options.headers || {};
	if (!options.headers['x-return-to']) {
		options.headers['x-return-to'] = `${window.location.pathname.slice(config.relative_path.length)}${window.location.search}`;
	}

	if (typeof callback === 'function') {
		xhr(options).then(result => callback(null, result), err => callback(err));
		return;
	}

	try {
		const result = await xhr(options);
		return result;
	} catch (err) {
		if (err.message === await translator.translate('[[error:api.401]]', config.userLang)) {
			const { url } = await fireHook('filter:admin.reauth', { url: 'login' });
			const message = await translator.translate('[[error:api.reauth-required]]', config.userLang);
			confirm(message, (ok) => {
				if (ok) {
					storage.setItem('location-hash', window.location.hash);
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
			const jsonError = isJSON && (response.status?.message || response.error || '');
			const fallbackError = typeof response === 'string' ? response : (res.statusText || `[[error:api.${res.status}]]`);
			throw new Error(isJSON && jsonError ?
				jsonError :
				fallbackError
			);
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

export function post(route, data, headers, onSuccess) {
	return callWithHeaders('POST', route, data, headers, onSuccess);
}

export function patch(route, data, headers, onSuccess) {
	return callWithHeaders('PATCH', route, data, headers, onSuccess);
}

export function put(route, data, headers, onSuccess) {
	return callWithHeaders('PUT', route, data, headers, onSuccess);
}

export function del(route, data, headers, onSuccess) {
	return callWithHeaders('DELETE', route, data, headers, onSuccess);
}

function callWithHeaders(method, route, data, headers, onSuccess) {
	typeof headers === 'function' && (onSuccess = headers, headers = {});
	return call({
		url: route,
		method,
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
			...headers,
		},
	}, onSuccess);
}