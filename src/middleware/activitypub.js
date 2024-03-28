'use strict';

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

	const acceptable = [
		'application/activity+json',
		'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
	];
	const pass = (accept && accept.split(',').some((value) => {
		const parts = value.split(';').map(v => v.trim());
		return acceptable.includes(value || parts[0]);
	})) || (contentType && acceptable.includes(contentType));

	if (!pass) {
		return next('route');
	}

	next();
};

middleware.validate = async function (req, res, next) {
	// Checks the validity of the incoming payload against the sender and rejects on failure
	const verified = await activitypub.verify(req);
	if (!verified) {
		return res.sendStatus(400);
	}

	// Sanity-check payload schema
	const required = ['type', 'actor', 'object'];
	if (!required.every(prop => req.body.hasOwnProperty(prop))) {
		return res.sendStatus(400);
	}

	const { actor, object } = req.body;

	// Origin checking
	if (typeof object !== 'string' && object.hasOwnProperty('id')) {
		const actorHostname = new URL(actor).hostname;
		const objectHostname = new URL(object.id).hostname;
		if (actorHostname !== objectHostname) {
			return res.sendStatus(403);
		}
	}

	// Cross-check key ownership against received actor
	await activitypub.actors.assert(actor);
	const compare = await db.getObjectField(`userRemote:${actor}:keys`, 'id');
	const { signature } = req.headers;
	const keyId = new Map(signature.split(',').filter(Boolean).map(v => v.split('='))).get('keyId');
	if (`"${compare}"` !== keyId) {
		return res.sendStatus(403);
	}

	next();
};

middleware.configureResponse = async function (req, res, next) {
	res.header('Content-Type', 'application/activity+json');
	next();
};
