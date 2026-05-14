'use strict';

const Intents = module.exports;

const activitypub = require('../../activitypub');

const helpers = require('../helpers');

Intents.query = async (req, res) => {
	let { handle } = req.params;
	handle = handle.trim().replace(/^@/, '');
	const webfinger = await activitypub.helpers.query(handle);

	// Parse out intents
	let intents = [];
	const prefix = 'https://w3id.org/fep/3b86/';
	if (!webfinger || !webfinger?._raw?.links) {
		helpers.formatApiResponse(200, res, { intents });
	}
	intents = webfinger._raw.links.reduce((memo, link) => {
		if (link.rel.startsWith(prefix)) {
			const intent = link.rel.slice(prefix.length).toLowerCase();
			memo[intent] = link.template;
		}
		return memo;
	}, {});
	helpers.formatApiResponse(200, res, { intents });
};