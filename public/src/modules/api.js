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

export function get(route, payload, onSuccess, onError) {
	return call({
		url: baseUrl + route + '?' + $.param(payload),
	}, onSuccess, onError);
}

export function post(route, payload, onSuccess, onError) {
	return call({
		url: baseUrl + route,
		method: 'post',
		data: payload,
	}, onSuccess, onError);
}

export function put(route, payload, onSuccess, onError) {
	return call({
		url: baseUrl + route,
		method: 'put',
		data: payload,
	}, onSuccess, onError);
}

export function del(route, payload, onSuccess, onError) {
	return call({
		url: baseUrl + route,
		method: 'delete',
		data: payload,
	}, onSuccess, onError);
}
