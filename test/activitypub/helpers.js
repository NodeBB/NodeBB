'use strict';

const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');
const slugify = require('../../src/slugify');

const Helpers = module.exports;

Helpers.mocks = {};

Helpers.mocks.person = (override = {}) => {
	const baseUrl = 'https://example.org';
	const uuid = utils.generateUUID();
	let id = `${baseUrl}/${uuid}`;
	if (override.hasOwnProperty('id')) {
		id = override.id;
	}


	const actor = {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://w3id.org/security/v1',
		],
		id,
		url: `${id}`,
		inbox: `${id}/inbox`,
		outbox: `${id}/outbox`,

		type: 'Person',
		name: slugify(uuid),
		preferredUsername: uuid,

		publicKey: {
			id: `${id}#key`,
			owner: `${id}`,
			publicKeyPem: 'todo',
		},
		...override,
	};

	activitypub._cache.set(`0;${id}`, actor);

	return { id, actor };
};

Helpers.mocks.group = (override = {}) => {
	const { id, actor } = Helpers.mocks.person({
		type: 'Group',
		...override,
	});

	activitypub._cache.set(`0;${id}`, actor);

	return { id, actor };
};

Helpers.mocks.note = (override = {}) => {
	const baseUrl = 'https://example.org';
	const uuid = utils.generateUUID();
	const id = `${baseUrl}/object/${uuid}`;
	const note = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		url: id,
		type: 'Note',
		to: ['https://www.w3.org/ns/activitystreams#Public'],
		cc: ['https://example.org/user/foobar/followers'],
		inReplyTo: null,
		attributedTo: 'https://example.org/user/foobar',
		name: utils.generateUUID(),
		content: `<p>${utils.generateUUID()}</p>`,
		published: new Date().toISOString(),
		...override,
	};

	// If any values contain the hardcoded string "remove", remove that prop
	Object.entries(note).forEach(([key, value]) => {
		if (value === 'remove') {
			delete note[key];
		}
	});
	activitypub._cache.set(`0;${id}`, note);

	return { id, note };
};

Helpers.mocks.create = (object) => {
	// object is optional, will generate a public note if undefined
	const baseUrl = 'https://example.org';
	const uuid = utils.generateUUID();
	const id = `${baseUrl}/activity/${uuid}`;

	object = object || Helpers.mocks.note().note;
	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: 'Create',
		to: ['https://www.w3.org/ns/activitystreams#Public'],
		cc: ['https://example.org/user/foobar/followers'],
		actor: 'https://example.org/user/foobar',
		object,
	};

	activitypub._cache.set(`0;${id}`, activity);

	return { id, activity };
};
