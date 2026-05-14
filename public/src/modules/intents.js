'use strict';

import { dialog } from 'bootbox';

export function get() {
	// Checks localStorage for whether an existing handle has been saved, and what intents they support
	// Multiple handles can be saved, so it should return a Map
}

export function save(handle, intents) {
	// Called by refresh, saves a handle into localStorage. Multiple handles can be active at any one time,
	// so possibly call get() and append the handle (or replace as necessary)
}

export function refresh(handle) {
	// Fires off a network request to backend to check whether the handle passed-in supports Activity Intents
	// should return { intents: Array }, where the array contains something like ['object', 'create'].
}

export function register() {
	// Throws a modal asking user to enter their Open Social Web handle
	// Use dialog(), template is at src/view/modals/intents/register.tpl
}