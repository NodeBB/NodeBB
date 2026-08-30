'use strict';

const nconf = require('nconf');
const activitypub = require('../../src/activitypub');
const request = require('../../src/request');
const utils = require('../../src/utils');
const slugify = require('../../src/slugify');

const Helpers = module.exports;

Helpers.mocks = {};

Helpers.mocks._baseUrl = 'https://example.org';

/*
 * The default remote person used by note()/create(). Created eagerly so that
 * the ActivityPub request cache and webfinger cache are populated — meaning
 * actors.assert() on the default note actor never needs a real outbound call.
 */
Helpers.mocks.foobar = (override = {}) => {
	if (!Helpers.mocks._foobar) {
		Helpers.mocks._foobar = Helpers.mocks.person({
			id: `${Helpers.mocks._baseUrl}/user/foobar`,
			preferredUsername: 'foobar',
			...override,
		});
	}
	return Helpers.mocks._foobar;
};

/*
 * Intercepts request.get for remote (non-local) URLs.
 * Objects are served from the ActivityPub request cache (ActivityPub._cache) —
 * the same cache ActivityPub.get() reads from — so anything registered by the
 * mock factories (person/group/note/create) is returned instantly without a
 * real outbound request. Unknown remote URLs get a 404, mirroring a fetch
 * failure. Requests to the local test server pass through untouched.
 *
 * Call helpers.mocks.mockRequests() in a suite's `before` and
 * helpers.mocks.restoreRequests() in its `after`.
 */
Helpers.mocks._mockRequestInstalled = false;

Helpers.mocks.mockRequests = function () {
	// Re-seed the default remote actor's caches (databasemock's resetAll() in
	// the top-level before hook wipes them after module load)
	Helpers.mocks._seedFoobarCaches();
	if (Helpers.mocks._mockRequestInstalled) {
		return;
	}
	const localHost = nconf.get('url_parsed').host;
	Helpers.mocks._originalGet = request.get;
	request.get = async (url, config) => {
		let host;
		try {
			host = new URL(url).host;
		} catch (e) {
			host = null;
		}
		if (!host || host === localHost) {
			return Helpers.mocks._originalGet(url, config);
		}
		const cached = activitypub._cache.get(`0;${url}`);
		if (cached !== undefined) {
			return {
				body: cached,
				response: {
					ok: true, status: 200, statusCode: 200, statusText: 'OK',
					headers: { 'content-type': 'application/activity+json' },
				},
				url,
			};
		}
		return {
			body: { error: 'Not Found' },
			response: {
				ok: false, status: 404, statusCode: 404, statusText: 'Not Found',
				headers: { 'content-type': 'application/activity+json' },
			},
			url,
		};
	};
	Helpers.mocks._mockRequestInstalled = true;
};

Helpers.mocks.restoreRequests = function () {
	if (!Helpers.mocks._mockRequestInstalled) {
		return;
	}
	request.get = Helpers.mocks._originalGet;
	Helpers.mocks._mockRequestInstalled = false;
};

Helpers.mocks.person = (override = {}) => {
	const uuid = utils.generateUUID();
	let id = `${Helpers.mocks._baseUrl}/${uuid}`;
	if (override.hasOwnProperty('id')) {
		id = override.id;
	}

	const username = override.preferredUsername || `user_${uuid.slice(0, 8)}`;

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
		preferredUsername: username,

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
		username: username,
		hostname: 'example.org',
		subject: `acct:${username}@example.org`,
		splitDomain: false,
		subjectHostname: 'example.org',
	});

	return { id, actor };
};

Helpers.mocks.group = (override = {}) => {
	const { id, actor } = Helpers.mocks.person({
		type: 'Group',
		...override,
	});
	const { hostname } = new URL(id);

	activitypub._cache.set(`0;${id}`, actor);
	activitypub.helpers._webfingerCache.set(`${actor.preferredUsername}@${hostname}`, {
		actorUri: id,
		username: actor.preferredUsername,
		hostname,
		subject: `acct:${actor.preferredUsername}@${hostname}`,
		splitDomain: false,
		subjectHostname: hostname,
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
		cc: [`${Helpers.mocks._baseUrl}/user/foobar/followers`],
		inReplyTo: null,
		attributedTo: `${Helpers.mocks._baseUrl}/user/foobar`,
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

Helpers.mocks.create = (input = {}) => {
	let object;
	let actor = 'https://example.org/user/foobar';
	let override = {};

	// Support both old API (positional note object) and new API (override object with actor/object keys)
	if (input && typeof input === 'object' && input.type === 'Note') {
		// Old API: first argument is the note object
		object = input;
	} else {
		// New API: override object
		override = input;
		object = override.object;
		actor = override.actor || actor;
		delete override.actor;
		delete override.object;
	}

	if (!object) {
		object = Helpers.mocks.note().note;
	}

	const uuid = utils.generateUUID();
	const id = `${Helpers.mocks._baseUrl}/activity/${uuid}`;

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: 'Create',
		to: ['https://www.w3.org/ns/activitystreams#Public'],
		cc: [`${actor}/followers`],
		actor,
		object,
		...override,
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

Helpers.mocks.undo = (override = {}) => {
	let actor = override.actor;
	let object = override.object;
	if (!actor) {
		({ id: actor } = Helpers.mocks.person());
	}
	if (!object) {
		({ id: object } = Helpers.mocks.note());
	}

	const uuid = utils.generateUUID();
	const id = `${Helpers.mocks._baseUrl}/undo/${uuid}`;

	const activity = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id,
		type: 'Undo',
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

// Eagerly register the default note actor so it is always assertable offline
Helpers.mocks.foobar();

/*
 * Re-populates the TTL caches for the default foobar actor.
 *
 * The caches are in-memory and get wiped by databasemock's `resetAll()`
 * (which runs in a top-level `before` hook, after all test files have been
 * loaded), so the eager module-load seeding is not enough — every suite that
 * installs the request mock must re-seed in its own `before`.
 */
Helpers.mocks._seedFoobarCaches = function () {
	const { id, actor } = Helpers.mocks.foobar();
	activitypub._cache.set(`0;${id}`, actor);
	activitypub.helpers._webfingerCache.set(`${actor.preferredUsername}@example.org`, {
		actorUri: id,
		username: actor.preferredUsername,
		hostname: 'example.org',
		subject: `acct:${actor.preferredUsername}@example.org`,
		splitDomain: false,
		subjectHostname: 'example.org',
	});
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

