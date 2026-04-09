'use strict';

export function init() {
	const errorsEl = document.getElementById('errors');
	if (errorsEl) {
		errorsEl.addEventListener('toggle', handleToggle, true);
	}
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