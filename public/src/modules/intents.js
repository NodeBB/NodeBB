'use strict';

import { dialog } from 'bootbox';
import { get } from 'api';
import * as alerts from './alerts';

const STORAGE_KEY = 'ap:intents:handles';

export function list() {
	let raw;
	try {
		raw = localStorage.getItem(STORAGE_KEY);
	} catch (e) {
		// localStorage unavailable (e.g. private browsing)
		return new Map();
	}

	if (!raw) {
		return new Map();
	}

	let handles;
	try {
		handles = JSON.parse(raw);
	} catch (e) {
		// Corrupt data — reset
		return new Map();
	}

	const map = new Map();
	if (Array.isArray(handles)) {
		handles.forEach(entry => {
			if (entry && entry.handle && Array.isArray(entry.intents)) {
				map.set(entry.handle, entry.intents);
			}
		});
	}
	return map;
}

export function save(handle, intents) {
	if (typeof handle !== 'string' || !handle.trim()) {
		return;
	}
	handle = handle.trim();
	if (!Array.isArray(intents)) {
		return;
	}

	const map = list();
	map.set(handle, intents);

	const entries = Array.from(map.entries()).map(([h, i]) => ({ handle: h, intents: i }));
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch (e) {
		// Storage full or unavailable — silently fail
	}
}

export async function refresh(handle) {
	if (typeof handle !== 'string' || !handle.trim()) {
		return null;
	}
	handle = handle.trim().replace(/^@/, '');

	try {
		const result = await get(`/api/v3/intents/query/${handle}`);
		if (result && result.intents && typeof result.intents === 'object') {
			const intents = Object.keys(result.intents);
			save(handle, intents);
			return { intents };
		}
	} catch (e) {
		// Network or server error — handle may not support intents
	}
	return null;
}

export function register() {
	let map = list();
	let handles = Array.from(map.entries()).map(([handle, intents]) => ({ handle, intents }));

	app.parseAndTranslate('modals/intents/register', {
		description: '[[intents:description]]',
		handles,
	}, (html) => {
		const modal = bootbox.dialog({
			title: '[[intents:title]]',
			message: html,
		});

		// html.on('hidden.bs.modal', function () {
		// 	html.remove();
		// });

		const handleInput = modal.find('#intents-handle-input');
		const submitBtn = modal.find('#intents-register-btn');

		const validateHandle = () => {
			const val = handleInput.val().trim();
			// Validate: must be in format @username@domain or username@domain
			const valid = /^@?[\w.-]+@[\w.-]+\.[\w]{2,}$/.test(val);
			submitBtn.prop('disabled', !valid);
		};

		handleInput.on('input', validateHandle);
		validateHandle();

		modal.find('#intents-register-form').on('submit', async (ev) => {
			ev.preventDefault();
			const handle = handleInput.val().trim();

			submitBtn.prop('disabled', true).text('[[global:loading]]');

			try {
				await refresh(handle);
				map = list();
				handles = Array.from(map.entries()).map(([handle, intents]) => ({ handle, intents }));
				const html = await app.parseAndTranslate('modals/intents/register', 'handles', { handles });
				modal.find('#intents-registered-list').html(html);
			} catch (e) {
				alerts.error('[[intents:register-error]]');
			} finally {
				submitBtn.prop('disabled', false);
			}
		});

		modal.on('click', '[data-action="remove"]', function () {
			const handleToRemove = $(this).attr('data-handle');
			const map = list();
			map.delete(handleToRemove);
			const entries = Array.from(map.entries()).map(([h, i]) => ({ handle: h, intents: i }));
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
			} catch (e) {
				// silently fail
			}
			$(this).closest('li').remove();

			if (!map.size) {
				modal.find('#intents-registered-list').closest('hr').next('h6, p').remove();
				modal.find('#intents-registered-list').closest('hr').prev('p').after('<p class="text-muted mt-3">[[intents:no-handles]]</p>');
			}
		});
	});
}