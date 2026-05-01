'use strict';

import { get } from 'api';

export function init(searchEl, listEl) {
	if (!searchEl || !listEl) {
		console.warn('[chats/search] Search element not found');
		return;
	}

	searchEl.addEventListener('keyup', utils.debounce(async function (e) {
		const data = await get(`/chats/search?query=${e.target.value}`);
		const html = await app.parseAndTranslate('chats', 'rooms', data);
		$(listEl).html(html);
	}, 300));
}