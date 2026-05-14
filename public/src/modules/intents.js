'use strict';

import { dialog } from 'bootbox';
import { get } from 'api';
import * as alerts from './alerts';

const STORAGE_KEY = 'ap:intents:handles';

const INTENT_DISPLAY_MAP = {
	create: 'Create & Reply',
	like: 'Upvote',
	dislike: 'Downvote',
	follow: 'Follow',
	object: 'View',
};

function mapIntentNames(intents) {
	return intents.map(intent => INTENT_DISPLAY_MAP[intent.toLowerCase()] || intent);
}

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
	let handles = Array.from(map.entries()).map(([handle, intents]) => ({
		handle,
		intents: mapIntentNames(intents).join(', '),
	}));

	app.parseAndTranslate('modals/intents/register', {
		description: '[[intents:description]]',
		handles,
	}, (html) => {
		const modal = dialog({
			title: '[[intents:title]]',
			message: html,
		});

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
				handles = Array.from(map.entries()).map(([handle, intents]) => ({
					handle,
					intents: mapIntentNames(intents).join(', '),
				}));
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

export function trigger(intent) {
	const map = list();
	const requiredIntent = intent.toLowerCase();
	const displayIntent = INTENT_DISPLAY_MAP[requiredIntent] || intent;

	const entries = Array.from(map.entries()).map(([handle, intents]) => ({ handle, intents }));
	const matchingHandles = entries
		.filter(entry => Array.isArray(entry.intents) && entry.intents.some(i => i.toLowerCase() === requiredIntent))
		.map(entry => ({ handle: entry.handle, intents: mapIntentNames(entry.intents).join(', ') }));

	app.parseAndTranslate('modals/intents/trigger', {
		displayIntent,
		matchingHandles,
		hasAnyHandles: map.size > 0,
	}, (html) => {
		const modal = dialog({
			title: `[[intents:trigger-title, ${displayIntent}]]`,
			message: html,
		});

		// Handle intent execution from a registered handle
		modal.on('click', '[data-action="execute-intent"]', function () {
			const handle = $(this).attr('data-handle');
			modal.modal('hide');
			console.log('Intent triggered:', intent, 'Handle:', handle);
		});

		// Open handle registration modal
		modal.on('click', '[data-action="open-register"]', function () {
			modal.modal('hide');
			setTimeout(() => register(), 300);
		});

		// Redirect to login
		modal.on('click', '[data-action="go-login"]', function () {
			modal.modal('hide');
			ajaxify.go('login');
		});
	});
}
