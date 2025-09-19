'use strict';

const db = require('../database');
const meta = require('../meta');
const activitypub = require('../activitypub');
const analytics = require('../analytics');
const helpers = require('./helpers');

const middleware = module.exports;

middleware.enabled = async (req, res, next) => next(!meta.config.activitypubEnabled ? 'route' : undefined);

middleware.pageview = async (req, res, next) => {
	await analytics.apPageView({ ip: req.ip });
	next();
};

middleware.assertS2S = async function (req, res, next) {
	// For whatever reason, express accepts does not recognize "profile" as a valid differentiator
	// Therefore, manual header parsing is used here.
	const { accept, 'content-type': contentType } = req.headers;
	if (!(accept || contentType)) {
		return next('route');
	}

	const pass = activitypub.helpers.assertAccept(accept) ||
		(contentType && activitypub._constants.acceptableTypes.includes(contentType));

	if (!pass) {
		return next('route');
	}

	next();
};

middleware.verify = async function (req, res, next) {
	// Verifies the HTTP Signature if present (required for POST)
	const passthrough = [/\/actor/, /\/uid\/\d+/];
	if (req.method === 'GET' && passthrough.some(regex => regex.test(req.path))) {
		return next();
	}

	if (req.method === 'POST') {
		const verified = await activitypub.verify(req);
		if (!verified) {
			activitypub.helpers.log('[middleware/activitypub] HTTP signature verification failed.');
			return res.sendStatus(400);
		}
	}

	// Set calling user
	if (req.headers.signature) {
		const keyId = req.headers.signature.split(',').filter(line => line.startsWith('keyId="'));
		if (keyId.length) {
			req.uid = keyId.shift().slice(7, -1).replace(/#.*$/, '');
		}
	}

	activitypub.helpers.log('[middleware/activitypub] HTTP signature verification passed.');
	next();
};

middleware.assertPayload = helpers.try(async function (req, res, next) {
	// Checks the validity of the incoming payload against the sender and rejects on failure
	activitypub.helpers.log('[middleware/activitypub] Validating incoming payload...');

	// Sanity-check payload schema
	const required = ['id', 'type', 'actor', 'object'];
	if (!required.every(prop => req.body.hasOwnProperty(prop))) {
		activitypub.helpers.log('[middleware/activitypub] Request body missing required properties.');
		return res.sendStatus(400);
	}
	activitypub.helpers.log('[middleware/activitypub] Request body check passed.');

	// History check
	const seen = await db.isSortedSetMember('activities:datetime', req.body.id);
	if (seen) {
		activitypub.helpers.log(`[middleware/activitypub] Activity already seen, ignoring (${req.body.id}).`);
		return res.sendStatus(200);
	}

	let { actor, object } = req.body;

	// Actor normalization
	if (typeof actor === 'object' && actor.hasOwnProperty('id')) {
		actor = actor.id;
		req.body.actor = actor;
	}
	if (Array.isArray(actor)) {
		actor = actor.map(a => (typeof a === 'string' ? a : a.id));
		req.body.actor = actor;
	}

	// Domain check
	const { hostname } = new URL(actor);
	const allowed = activitypub.instances.isAllowed(hostname);
	if (!allowed) {
		activitypub.helpers.log(`[middleware/activitypub] Blocked incoming activity from ${hostname}.`);
		return res.sendStatus(403);
	}
	activitypub.instances.log(hostname);

	// Origin checking
	if (typeof object !== 'string' && object.hasOwnProperty('id')) {
		const actorHostnames = Array.isArray(actor) ? actor.map(a => new URL(a).hostname) : [new URL(actor).hostname];
		const objectHostname = new URL(object.id).hostname;
		// require that all actors have the same hostname as the object for now
		if (!actorHostnames.every(actorHostname => actorHostname === objectHostname)) {
			activitypub.helpers.log('[middleware/activitypub] Origin check failed, stripping object down to id.');
			req.body.object = [object.id];
		}
		activitypub.helpers.log('[middleware/activitypub] Origin check passed.');
	}

	// Cross-check key ownership against received actor
	await activitypub.actors.assert(actor);
	let compare = await db.getObjectsFields([
		`userRemote:${actor}:keys`, `categoryRemote:${actor}:keys`,
	], ['id']);
	compare = compare.reduce((keyId, { id }) => keyId || id || '', '').replace(/#[\w-]+$/, '');

	const { signature } = req.headers;
	let keyId = new Map(signature.split(',').filter(Boolean).map((v) => {
		const index = v.indexOf('=');
		return [v.substring(0, index), v.slice(index + 1)];
	})).get('keyId');
	keyId = (keyId || '').slice(1, -1).replace(/#[\w-]+$/, '');
	if (compare !== keyId) {
		activitypub.helpers.log('[middleware/activitypub] Key ownership cross-check failed.');
		return res.sendStatus(403);
	}
	activitypub.helpers.log('[middleware/activitypub] Key ownership cross-check passed.');

	next();
});

middleware.resolveObjects = async function (req, res, next) {
	const { type, object } = req.body;
	if (type !== 'Delete' && (typeof object === 'string' || (Array.isArray(object) && object.every(o => typeof o === 'string')))) {
		activitypub.helpers.log('[middleware/activitypub] Resolving object(s)...');
		try {
			req.body.object = await activitypub.helpers.resolveObjects(object);
			activitypub.helpers.log('[middleware/activitypub] Object(s) successfully resolved.');
		} catch (e) {
			activitypub.helpers.log('[middleware/activitypub] Failed to resolve object(s).');
			return res.sendStatus(424);
		}
	}

	next();
};

// todo: deprecate... this should be handled in actor and note assertion methods instead, or perhaps via helper fn
middleware.normalize = async function (req, res, next) {
	// Normalizes the received data structure
	const { body } = req;
	const { object } = body;

	// Ensure `to` and `cc` are arrays in the object
	['to', 'cc'].forEach((prop) => {
		if (object[prop] && typeof object[prop] === 'string') {
			object[prop] = [object[prop]];
		}
	});

	next();
};

middleware.configureResponse = async function (req, res, next) {
	res.header('Content-Type', 'application/activity+json');
	next();
};
