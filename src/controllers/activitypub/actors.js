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
		id: `${nconf.get('url')}`,
		url: `${nconf.get('url')}`,
		inbox: `${nconf.get('url')}/inbox`,
		outbox: `${nconf.get('url')}/outbox`,

		type: 'Application',
		name,

		publicKey: {
			id: `${nconf.get('url')}#key`,
			owner: nconf.get('url'),
			publicKeyPem: publicKey,
		},
	});
};

Actors.user = async function (req, res) {
	// todo: view:users priv gate
	const { userslug } = req.params;
	const { uid } = res.locals;
	const { username, displayname: name, aboutme, picture, 'cover:url': cover } = await user.getUserData(uid);
	const publicKey = await activitypub.getPublicKey(uid);

	res.status(200).json({
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://w3id.org/security/v1',
		],
		id: `${nconf.get('url')}/user/${userslug}`,
		url: `${nconf.get('url')}/user/${userslug}`,
		followers: `${nconf.get('url')}/user/${userslug}/followers`,
		following: `${nconf.get('url')}/user/${userslug}/following`,
		inbox: `${nconf.get('url')}/user/${userslug}/inbox`,
		outbox: `${nconf.get('url')}/user/${userslug}/outbox`,

		type: 'Person',
		name,
		preferredUsername: username,
		summary: aboutme,
		icon: picture ? `${nconf.get('url')}${picture}` : null,
		image: cover ? `${nconf.get('url')}${cover}` : null,

		publicKey: {
			id: `${nconf.get('url')}/user/${userslug}#key`,
			owner: `${nconf.get('url')}/user/${userslug}`,
			publicKeyPem: publicKey,
		},
	});
};
