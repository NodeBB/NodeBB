'use strict';

import { dialog } from 'bootbox';
import { get } from 'api';

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
		if (result && Array.isArray(result.intents)) {
			save(handle, result.intents);
			return { intents: result.intents };
		}
	} catch (e) {
		// Network or server error — handle may not support intents
	}
	return null;
}

export function register() {
	// Throws a modal asking user to enter their Open Social Web handle
	// Use dialog(), template is at src/view/modals/intents/register.tpl
}