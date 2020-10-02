'use strict';

define('api', () => {
	const api = {};
	const baseUrl = config.relative_path + '/api/v1';

	function call(options, onSuccess, onError) {
		$.ajax(options)
			.done((res) => {
				if (onSuccess) {
					onSuccess(res.response);
				}
			})
			.fail((ev) => {
				if (onError) {
					onError(ev.responseJSON);
				}
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
