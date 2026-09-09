'use strict';

import { get } from 'api';

export function init() {
	const errorsEl = document.getElementById('errors');
	if (errorsEl) {
		errorsEl.addEventListener('toggle', handleToggle, true);
	}

	const hostnameFilterEl = document.getElementById('hostnameFilter');
	const typeFilterEl = document.getElementById('typeFilter');

	if (hostnameFilterEl) {
		hostnameFilterEl.addEventListener('input', utils.debounce(handleFilterChange, 300));
	}
	if (typeFilterEl) {
		typeFilterEl.addEventListener('change', handleFilterChange);
	}
}

function handleFilterChange() {
	const hostnameFilterEl = document.getElementById('hostnameFilter');
	const typeFilterEl = document.getElementById('typeFilter');

	const params = {};
	if (hostnameFilterEl.value.trim()) {
		params.hostname = hostnameFilterEl.value.trim();
	}
	if (typeFilterEl.value) {
		params.type = typeFilterEl.value;
	}

	get(`/api${ajaxify.data.url}`, params).then(async (data) => {
		const html = await app.parseAndTranslate('admin/federation/errors', 'errors', { errors: data.errors });
		const errorsEl = document.getElementById('errors');
		if (errorsEl) {
			$(errorsEl).html(html);
			errorsEl.addEventListener('toggle', handleToggle, true);
		}
		$('#payload').text('');
	});
}

function handleToggle(e) {
	const payloadEl = document.getElementById('payload');

	if (e.target.open) {
		const index = e.target.getAttribute('data-index');
		const error = ajaxify.data.errors[index];
		console.log(error);

		payloadEl.innerText = error.body;
	} else {
		payloadEl.innerText = '';
	}
}


