/* eslint-disable import/no-unresolved */

'use strict';

import { fire as fireHook } from 'hooks';
import { confirm } from 'bootbox';

const baseUrl = config.relative_path + '/api/v3';

function call(options, callback) {
	options.url = options.url.startsWith('/api') ?
		config.relative_path + options.url :
		baseUrl + options.url;

	if (typeof callback === 'function') {
		xhr(options, callback);
		return;
	}

	return new Promise((resolve, reject) => {
		xhr(options, function (err, data) {
			if (err) {
				if (err.message === 'A valid login session was not found. Please log in and try again.') {
					return confirm('[[error:api.reauth-required]]', (ok) => {
						if (ok) {
							ajaxify.go('login');
						}
					});
				}

				return reject(err);
			}

			resolve(data);
		});
	});
}

async function xhr(options, cb) {
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

	await fetch(url, {
		...options,
	}).then(async (res) => {
		const response = await res.json();
		if (Math.floor(res.status / 100) === 2) {
			cb(null, (
				response &&
					response.hasOwnProperty('status') &&
					response.hasOwnProperty('response') ? response.response : (response || {})
			));
		} else {
			cb(new Error(response.status.message));
		}
	}).catch(cb);
}

export function get(route, data, onSuccess) {
	return call({
		url: route + (data && Object.keys(data).length ? ('?' + $.param(data)) : ''),
	}, onSuccess);
}

export function head(route, data, onSuccess) {
	return call({
		url: route + (data && Object.keys(data).length ? ('?' + $.param(data)) : ''),
		method: 'head',
	}, onSuccess);
}

export function post(route, data, onSuccess) {
	return call({
		url: route,
		method: 'post',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function patch(route, data, onSuccess) {
	return call({
		url: route,
		method: 'patch',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function put(route, data, onSuccess) {
	return call({
		url: route,
		method: 'put',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function del(route, data, onSuccess) {
	return call({
		url: route,
		method: 'delete',
		data,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}
