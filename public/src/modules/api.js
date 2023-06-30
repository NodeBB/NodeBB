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
	/**
	 * N.B. fetch api is only used when payload is a FormData object!
	 *
	 * This is because the passed-in options are different between fetch/jQuery .ajax()
	 * If we updated the code to use only fetch, it would be a breaking change.
	 *
	 * Prior to v3.3 there was no support for sending in FormData, so the addition of fetch
	 * handling is not breaking.
	 *
	 * Break this for v4 by making everything use fetch api.
	 */

	// Adjust options based on payload type
	if (options.payload instanceof FormData) {
		const url = options.url;
		options.body = options.payload;
		delete options.payload;
		delete options.url;

		// Allow options to be modified by plugins, etc.
		({ options } = await fireHook('filter:api.fetchOptions', { options }));

		await fetch(url, {
			...options,
		}).then((res) => {
			cb(null, res);
		}).catch(cb);
	} else {
		options.data = JSON.stringify(options.payload || {});
		options.contentType = 'application/json; charset=utf-8';
		delete options.payload;

		// Allow options to be modified by plugins, etc.
		({ options } = await fireHook('filter:api.options', { options }));

		$.ajax(options)
			.done((res) => {
				cb(null, (
					res &&
					res.hasOwnProperty('status') &&
					res.hasOwnProperty('response') ? res.response : (res || {})
				));
			})
			.fail((ev) => {
				let errMessage;
				if (ev.responseJSON) {
					errMessage = ev.responseJSON.status && ev.responseJSON.status.message ?
						ev.responseJSON.status.message :
						ev.responseJSON.error;
				}

				cb(new Error(errMessage || ev.statusText));
			});
	}
}

export function get(route, payload, onSuccess) {
	return call({
		url: route + (payload && Object.keys(payload).length ? ('?' + $.param(payload)) : ''),
	}, onSuccess);
}

export function head(route, payload, onSuccess) {
	return call({
		url: route + (payload && Object.keys(payload).length ? ('?' + $.param(payload)) : ''),
		method: 'head',
	}, onSuccess);
}

export function post(route, payload, onSuccess) {
	return call({
		url: route,
		method: 'post',
		payload,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function patch(route, payload, onSuccess) {
	return call({
		url: route,
		method: 'patch',
		payload,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function put(route, payload, onSuccess) {
	return call({
		url: route,
		method: 'put',
		payload,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function del(route, payload, onSuccess) {
	return call({
		url: route,
		method: 'delete',
		data: JSON.stringify(payload),
		contentType: 'application/json; charset=utf-8',
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}
