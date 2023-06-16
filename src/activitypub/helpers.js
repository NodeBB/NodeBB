'use strict';

const request = require('request-promise-native');

const ttl = require('../cache/ttl');

const webfingerCache = ttl({ ttl: 1000 * 60 * 60 * 24 }); // 24 hours

const Helpers = module.exports;

Helpers.query = async (id) => {
	const [username, hostname] = id.split('@');
	if (!username || !hostname) {
		return false;
	}

	if (webfingerCache.has(id)) {
		return webfingerCache.get(id);
	}

	// Make a webfinger query to retrieve routing information
	const response = await request(`https://${hostname}/.well-known/webfinger?resource=acct:${id}`, {
		simple: false,
		resolveWithFullResponse: true,
		json: true,
	});

	if (response.statusCode !== 200 || !response.body.hasOwnProperty('links')) {
		return false;
	}

	// Parse links to find actor endpoint
	let actorUri = response.body.links.filter(link => link.type === 'application/activity+json' && link.rel === 'self');
	if (actorUri.length) {
		actorUri = actorUri.pop();
		({ href: actorUri } = actorUri);
	}

	webfingerCache.set(id, { username, hostname, actorUri });
	return { username, hostname, actorUri };
};
