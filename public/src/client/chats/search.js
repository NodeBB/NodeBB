'use strict';

import { get } from 'api';

export function init(searchEl, listEl) {
	if (!searchEl || !listEl) {
		console.warn('[chats/search] Search element not found');
	}

	// Debounce function to limit how often the keyup handler fires
	const debounce = (func, delay) => {
		let timeoutId;
		return function (...args) {
			clearTimeout(timeoutId);
			timeoutId = setTimeout(() => func.apply(this, args), delay);
		};
	};

	searchEl.addEventListener('keyup', debounce(async function (e) {
		const data = await get(`/chats/search?query=${e.target.value}`);
		console.log(data);
		const html = await app.parseAndTranslate('chats', 'rooms', data);
		$(listEl).html(html);
	}, 300));
}