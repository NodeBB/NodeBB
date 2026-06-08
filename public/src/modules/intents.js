'use strict';

import { dialog } from 'bootbox';
import { get } from 'api';
import storage from 'storage';
import { translate, translateKeys } from 'translator';

import * as alerts from './alerts';

const STORAGE_KEY = 'ap:intents:handles';

function getStoredData() {
	try {
		return storage.getItem(STORAGE_KEY);
	} catch (e) {
		return null;
	}
}

function setStoredData(data) {
	try {
		storage.setItem(STORAGE_KEY, data);
	} catch (e) {
		// Storage full or unavailable — silently fail
	}
}

const INTENT_DISPLAY_MAP = {
	create: '[[intents:display.create]]',
	like: '[[intents:display.like]]',
	dislike: '[[intents:display.dislike]]',
	follow: '[[intents:display.follow]]',
	object: '[[intents:display.object]]',
};

async function mapIntentNames(intents) {
	return await translateKeys(Object.keys(intents).map(intent => `${INTENT_DISPLAY_MAP[intent.toLowerCase()]}`));
}

export function list() {
	const raw = getStoredData();
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
			if (entry && entry.handle && typeof entry.intents === 'object' && !Array.isArray(entry.intents)) {
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
	if (!intents || typeof intents !== 'object' || Array.isArray(intents)) {
		return;
	}

	const map = list();
	map.set(handle, intents);

	const entries = Array.from(map.entries()).map(([h, i]) => ({ handle: h, intents: i }));
	setStoredData(JSON.stringify(entries));
}

export async function refresh(handle) {
	if (typeof handle !== 'string' || !handle.trim()) {
		return null;
	}
	handle = handle.trim().replace(/^@/, '');

	const result = await get(`/api/v3/intents/query/${handle}`);
	if (result && result.intents && typeof result.intents === 'object') {
		save(handle, result.intents);
		return { intents: Object.keys(result.intents) };
	}
	return null;
}

export async function register() {
	let map = list();
	let handles = await Promise.all(Array.from(map.entries()).map(async ([handle, intents]) => ({
		handle,
		intents: (await mapIntentNames(intents)).join(', '),
	})));

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
			submitBtn.prop('disabled', true);

			try {
				await refresh(handle);
				map = list();
				handles = await Promise.all(Array.from(map.entries()).map(async ([handle, intents]) => ({
					handle,
					intents: (await mapIntentNames(intents)).join(', '),
				})));
				const html = await app.parseAndTranslate('modals/intents/register', 'handles', { handles });
				modal.find('#intents-registered-list').html(html);
			} catch (e) {
				alerts.error(e.message);
			} finally {
				handleInput.val('');
				submitBtn.prop('disabled', false);
			}
		});

		modal.on('click', '[data-action="remove"]', function () {
			const handleToRemove = $(this).attr('data-handle');
			const map = list();
			map.delete(handleToRemove);
			const entries = Array.from(map.entries()).map(([h, i]) => ({ handle: h, intents: i }));
			setStoredData(JSON.stringify(entries));
			$(this).closest('li').remove();

			if (!map.size) {
				modal.find('#intents-registered-list').closest('hr').next('h6, p').remove();
				modal.find('#intents-registered-list').closest('hr').prev('p').after('<p class="text-muted mt-3">[[intents:no-handles]]</p>');
			}
		});
	});
}

const INTENTS_GUEST_SELECTORS = '[component="topic/reply/guest"], [component="category/post/guest"]';

// called by various init scripts in different pages' js to add handlers for "Log in to post" buttons, et al.
export function addHandlers() {
	document.removeEventListener('click', _intentsHandler);
	document.addEventListener('click', _intentsHandler, true); // capture phase
}

function _intentsHandler(e) {
	const target = e.target.closest(INTENTS_GUEST_SELECTORS);
	if (target) {
		e.preventDefault();
		e.stopPropagation();

		const tid = ajaxify.data.tid;
		const cid = ajaxify.data.cid;
		const payload = {};

		if (tid) {
			payload.inReplyTo = utils.isNumber(ajaxify.data.mainPid) ? `${config.url}/post/${ajaxify.data.mainPid}` : ajaxify.data.mainPid;
			payload.content = `@${ajaxify.data.author.userslug}`;
		} else if (cid) {
			payload.content = `@${ajaxify.data.handleFull}`;
		}

		trigger('create', payload);
	}
}

export async function trigger(intent, parameters) {
	const map = list();
	const requiredIntent = intent.toLowerCase();
	const displayKey = INTENT_DISPLAY_MAP[requiredIntent];

	const displayIntent = (await translate(`${displayKey || intent}`));

	const entries = Array.from(map.entries())
		.filter(([, intents]) => intents && typeof intents === 'object' && requiredIntent in intents)
		.map(([handle, intents]) => ({ handle, intents }));

	const matchingHandles = await Promise.all(entries.map(async ({ handle, intents }) => ({
		handle,
		intents: (await mapIntentNames(intents)).join(', '),
	})));

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
			const intents = map.get(handle);
			let url = intents && intents[requiredIntent];

			// Replace template placeholders with URL-encoded parameter values
			if (url && parameters && typeof parameters === 'object') {
				Object.keys(parameters).forEach((prop) => {
					const value = parameters[prop];
					const match = `{${prop}}`;
					if (url.includes(match)) {
						url = url.replaceAll(match, encodeURIComponent(value));
					}
				});
			}

			// Remove any unmatched placeholders
			url = url?.replaceAll(/\{[^}]+\}/g, '');

			if (url) {
				// Validate URL scheme to prevent XSS via javascript: data: etc.
				try {
					const parsed = new URL(url);
					if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
						window.location.href = url;
					}
				} catch (e) {
					// Invalid URL, silently ignore
				}
			}
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
