'use strict';

const activitypub = require('../../src/activitypub');
const utils = require('../../src/utils');
const slugify = require('../../src/slugify');

const Helpers = module.exports;

Helpers.mocks = {};

Helpers.mocks._baseUrl = 'https://example.org';

Helpers.mocks.person = (override = {}) => {
	const uuid = utils.generateUUID();
	let id = `${Helpers.mocks._baseUrl}/${uuid}`;
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
		name: slugify(id),
		preferredUsername: id,

		publicKey: {
			id: `${id}#key`,
			owner: `${id}`,
			publicKeyPem: 'todo',
		},
		...override,
	};

	activitypub._cache.set(`0;${id}`, actor);
	activitypub.helpers._webfingerCache.set(`${actor.preferredUsername}@example.org`, {
		actorUri: id,
		username: id,
		hostname: 'example.org',
	});

	return { id, actor };
};

Helpers.mocks.group = (override = {}) => {
	const { id, actor } = Helpers.mocks.person({
		type: 'Group',
		...override,
	});

	activitypub._cache.set(`0;${id}`, actor);
	activitypub.helpers._webfingerCache.set(`${actor.preferredUsername}@example.org`, {
		actorUri: id,
		username: id,
		hostname: 'example.org',
	});

	return { id, actor };
};

Helpers.mocks.note = (override = {}) => {
	const uuid = utils.generateUUID();
	const id = `${Helpers.mocks._baseUrl}/object/${uuid}`;
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
	const uuid = utils.generateUUID();
	const id = `${Helpers.mocks._baseUrl}/activity/${uuid}`;

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

Helpers.mocks.accept = (actor, object) => {
	const uuid = utils.generateUUID();
	const id = `${Helpers.mocks._baseUrl}/activity/${uuid}`;

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: 'Accept',
		to: ['https://www.w3.org/ns/activitystreams#Public'],
		actor,
		object,
	};

	return { activity };
};

Helpers.mocks.like = (override = {}) => {
	let actor = override.actor;
	let object = override.object;
	if (!actor) {
		({ id: actor } = Helpers.mocks.person());
	}
	if (!object) {
		({ id: object } = Helpers.mocks.note());
	}

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${Helpers.mocks._baseUrl}/like/${encodeURIComponent(object.id || object)}`,
		type: 'Like',
		actor,
		object,
	};

	return { activity };
};

Helpers.mocks.follow = (override = {}) => {
	let actor = override.actor;
	let object = override.object;
	if (!actor) {
		({ id: actor } = Helpers.mocks.person());
	}
	if (!object) {
		({ id: object } = Helpers.mocks.person());
	}
	delete override.actor;
	delete override.object;

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${Helpers.mocks._baseUrl}/follow/${encodeURIComponent(object.id || object)}`,
		type: 'Follow',
		to: [activitypub._constants.publicAddress],
		cc: [`${actor}/followers`],
		actor,
		object,
		...override,
	};

	return { activity };
};

Helpers.mocks.announce = (override = {}) => {
	let actor = override.actor;
	let object = override.object;
	if (!actor) {
		({ id: actor } = Helpers.mocks.person());
	}
	if (!object) {
		({ id: object } = Helpers.mocks.note());
	}
	delete override.actor;
	delete override.object;

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${Helpers.mocks._baseUrl}/announce/${encodeURIComponent(object.id || object)}`,
		type: 'Announce',
		to: [activitypub._constants.publicAddress],
		cc: [`${actor}/followers`],
		actor,
		object,
		...override,
	};

	return { activity };
};

Helpers.mocks.update = (override = {}) => {
	let actor = override.actor;
	let object = override.object;
	if (!actor) {
		({ id: actor } = Helpers.mocks.person());
	}
	if (!object) {
		({ id: object } = Helpers.mocks.note());
	}

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${Helpers.mocks._baseUrl}/update/${encodeURIComponent(object.id || object)}`,
		type: 'Update',
		to: [activitypub._constants.publicAddress],
		cc: [`${actor}/followers`],
		actor,
		object,
	};

	return { activity };
};

Helpers.mocks.delete = (override = {}) => {
	let actor = override.actor;
	let object = override.object;
	if (!actor) {
		({ id: actor } = Helpers.mocks.person());
	}
	if (!object) {
		({ id: object } = Helpers.mocks.note());
	}

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${Helpers.mocks._baseUrl}/delete/${encodeURIComponent(object.id || object)}`,
		type: 'Delete',
		to: [activitypub._constants.publicAddress],
		cc: [`${actor}/followers`],
		actor,
		object,
	};

	return { activity };
};

