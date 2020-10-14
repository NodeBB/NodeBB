'use strict';

define('api', () => {
	const api = {};
	const baseUrl = config.relative_path + '/api/v3';

	function call(options, callback) {
		return new Promise((resolve, reject) => {
			$.ajax(Object.assign({
				headers: {
					'x-csrf-token': config.csrf_token,
				},
			}, options))
				.done((res) => {
					resolve(res.response);

					if (callback) {
						callback(undefined, res.response);
					}
				})
				.fail((ev) => {
					const error = new Error(ev.responseJSON.status.message);
					reject(error);

					if (!utils.hasLanguageKey(ev.responseJSON.status.message)) {
						app.alertError(ev.responseJSON.status.message);
					}

					if (callback) {
						callback(error);
					}
				});
		});
	}

	api.get = (route, payload, onSuccess, onError) => call({
		url: baseUrl + route + '?' + $.param(payload),
	}, onSuccess, onError);

	api.post = (route, payload, onSuccess, onError) => call({
		url: baseUrl + route,
		method: 'post',
		data: payload,
	}, onSuccess, onError);

	api.put = (route, payload, onSuccess, onError) => call({
		url: baseUrl + route,
		method: 'put',
		data: payload,
	}, onSuccess, onError);

	api.del = (route, payload, onSuccess, onError) => call({
		url: baseUrl + route,
		method: 'delete',
		data: payload,
	}, onSuccess, onError);

	return api;
});
