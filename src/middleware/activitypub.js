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

	const { actor, object } = req.body;

	// Origin checking
	if (typeof object !== 'string' && object.hasOwnProperty('id')) {
		const actorHostname = new URL(actor).hostname;
		const objectHostname = new URL(object.id).hostname;
		if (actorHostname !== objectHostname) {
			winston.verbose('[middleware/activitypub] Origin check failed.');
			return res.sendStatus(403);
		}
		winston.verbose('[middleware/activitypub] Origin check passed.');
	}

	// Cross-check key ownership against received actor
	await activitypub.actors.assert(actor);
	const compare = await db.getObjectField(`userRemote:${actor}:keys`, 'id');
	const { signature } = req.headers;
	const keyId = new Map(signature.split(',').filter(Boolean).map(v => v.split('='))).get('keyId');
	if (`"${compare}"` !== keyId) {
		winston.verbose('[middleware/activitypub] Key ownership cross-check failed.');
		return res.sendStatus(403);
	}
	winston.verbose('[middleware/activitypub] Key ownership cross-check passed.');

	next();
};

middleware.configureResponse = async function (req, res, next) {
	res.header('Content-Type', 'application/activity+json');
	next();
};
