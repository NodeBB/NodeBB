'use strict';

const nconf = require('nconf');

const user = require('../../user');
const meta = require('../../meta');
const activitypub = require('../../activitypub');

const Actors = module.exports;

Actors.application = async function (req, res) {
	const publicKey = await activitypub.getPublicKey(0);
	const name = meta.config.title || 'NodeBB';

	res.status(200).json({
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://w3id.org/security/v1',
		],
		id: `${nconf.get('url')}/actor`,
		url: `${nconf.get('url')}/actor`,
		inbox: `${nconf.get('url')}/inbox`,
		outbox: `${nconf.get('url')}/outbox`,

		type: 'Application',
		name,
		preferredUsername: nconf.get('url_parsed').hostname,

		publicKey: {
			id: `${nconf.get('url')}/actor#key`,
			owner: `${nconf.get('url')}/actor`,
			publicKeyPem: publicKey,
		},
	});
};

Actors.user = async function (req, res) {
	// todo: view:users priv gate
	const { uid } = res.locals;
	const payload = await activitypub.mocks.actor(uid);

	res.status(200).json(payload);
};
