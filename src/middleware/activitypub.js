'use strict';

const winston = require('winston');

const db = require('../database');
const meta = require('../meta');
const activitypub = require('../activitypub');

const middleware = module.exports;

middleware.enabled = async (req, res, next) => next(!meta.config.activitypubEnabled ? 'route' : undefined);

middleware.assertS2S = async function (req, res, next) {
	// For whatever reason, express accepts does not recognize "profile" as a valid differentiator
	// Therefore, manual header parsing is used here.
	const { accept, 'content-type': contentType } = req.headers;
	if (!(accept || contentType)) {
		return next('route');
	}

	const pass = (accept && accept.split(',').some((value) => {
		const parts = value.split(';').map(v => v.trim());
		return activitypub._constants.acceptableTypes.includes(value || parts[0]);
	})) || (contentType && activitypub._constants.acceptableTypes.includes(contentType));

	if (!pass) {
		return next('route');
	}

	next();
};

middleware.validate = async function (req, res, next) {
	winston.verbose('[middleware/activitypub] Validating incoming payload...');
	// Checks the validity of the incoming payload against the sender and rejects on failure
	const verified = await activitypub.verify(req);
	if (!verified) {
		winston.verbose('[middleware/activitypub] HTTP signature verification failed.');
		return res.sendStatus(400);
	}
	winston.verbose('[middleware/activitypub] HTTP signature verification passed.');

	// Sanity-check payload schema
	const required = ['type', 'actor', 'object'];
	if (!required.every(prop => req.body.hasOwnProperty(prop))) {
		winston.verbose('[middleware/activitypub] Request body missing required properties.');
		return res.sendStatus(400);
	}
	winston.verbose('[middleware/activitypub] Request body check passed.');

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

	// Origin checking
	if (typeof object !== 'string' && object.hasOwnProperty('id')) {
		const actorHostnames = Array.isArray(actor) ? actor.map(a => new URL(a).hostname) : [new URL(actor).hostname];
		const objectHostname = new URL(object.id).hostname;
		// require that all actors have the same hostname as the object for now
		if (!actorHostnames.every(actorHostname => actorHostname === objectHostname)) {
			winston.verbose('[middleware/activitypub] Origin check failed, stripping object down to id.');
			req.body.object = [object.id];
		}
		winston.verbose('[middleware/activitypub] Origin check passed.');
	}

	// Cross-check key ownership against received actor
	await activitypub.actors.assert(actor);
	const compare = await db.getObjectField(`userRemote:${actor}:keys`, 'id');
	const { signature } = req.headers;
	const keyId = new Map(signature.split(',').filter(Boolean).map((v) => {
		const index = v.indexOf('=');
		return [v.substring(0, index), v.slice(index + 1)];
	})).get('keyId');
	if (`"${compare}"` !== keyId) {
		winston.verbose('[middleware/activitypub] Key ownership cross-check failed.');
		return res.sendStatus(403);
	}
	winston.verbose('[middleware/activitypub] Key ownership cross-check passed.');

	next();
};

middleware.resolveObjects = async function (req, res, next) {
	const { object } = req.body;
	if (typeof object === 'string' || (Array.isArray(object) && object.every(o => typeof o === 'string'))) {
		winston.verbose('[middleware/activitypub] Resolving object(s)...');
		try {
			req.body.object = await activitypub.helpers.resolveObjects(object);
			winston.verbose('[middleware/activitypub] Object(s) successfully resolved.');
		} catch (e) {
			winston.verbose('[middleware/activitypub] Failed to resolve object(s).');
			return res.sendStatus(424);
		}
	}
	next();
};

middleware.configureResponse = async function (req, res, next) {
	res.header('Content-Type', 'application/activity+json');
	next();
};
