'use strict';

define('api', () => {
	const api = {};
	const baseUrl = config.relative_path + '/api/v3';

	function call(options, callback) {
		options.url = options.url.startsWith('/api') ?
			config.relative_path + options.url :
			baseUrl + options.url;

		function doAjax(cb) {
			$.ajax(options)
				.done((res) => {
					cb(null,
						res.hasOwnProperty('status') && res.hasOwnProperty('response') ?
							res.response : res
					);
				})
				.fail((ev) => {
					const errMessage = ev.responseJSON.status && ev.responseJSON.status.message ?
						ev.responseJSON.status.message :
						ev.responseJSON.error;

					cb(new Error(errMessage || ev.statusText));
				});
		}

		if (typeof callback === 'function') {
			doAjax(callback);
			return;
		}

		return new Promise((resolve, reject) => {
			doAjax(function (err, data) {
				if (err) reject(err);
				else resolve(data);
			});
		});
	}

	api.get = (route, payload, onSuccess) => call({
		url: route + (Object.keys(payload).length ? ('?' + $.param(payload)) : ''),
	}, onSuccess);

	api.post = (route, payload, onSuccess) => call({
		url: route,
		method: 'post',
		data: payload,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);

	api.put = (route, payload, onSuccess) => call({
		url: route,
		method: 'put',
		data: payload,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);

	api.del = (route, payload, onSuccess) => call({
		url: route,
		method: 'delete',
		data: payload,
		headers: {
			'x-csrf-token': config.csrf_token,
		},
	}, onSuccess);

	return api;
});
