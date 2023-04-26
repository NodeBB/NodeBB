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
		data: JSON.stringify(payload || {}),
		contentType: 'application/json; charset=utf-8',
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function patch(route, payload, onSuccess) {
	return call({
		url: route,
		method: 'patch',
		data: JSON.stringify(payload || {}),
		contentType: 'application/json; charset=utf-8',
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);
}

export function put(route, payload, onSuccess) {
	return call({
		url: route,
		method: 'put',
		data: JSON.stringify(payload || {}),
		contentType: 'application/json; charset=utf-8',
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
