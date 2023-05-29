'use strict';

const request = require('request-promise-native');

const Helpers = module.exports;

Helpers.query = async (id) => {
	const [username, hostname] = id.split('@');
	if (!username || !hostname) {
		return false;
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

	return { username, hostname, actorUri };
};
