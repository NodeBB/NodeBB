'use strict';

const nconf = require('nconf');

const user = require('../user');
const activitypub = require('../activitypub');

const Controller = module.exports;

Controller.getActor = async (req, res) => {
	// todo: view:users priv gate
	const { userslug } = req.params;
	const { uid } = res.locals;
	const { username, aboutme, picture, 'cover:url': cover } = await user.getUserData(uid);
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
		preferredUsername: username,
		summary: aboutme,
		icon: picture ? `${nconf.get('url')}${picture}` : null,
		image: cover ? `${nconf.get('url')}${cover}` : null,

		publicKey: {
			id: `${nconf.get('url')}/user/${userslug}`,
			owner: `${nconf.get('url')}/user/${userslug}#key`,
			publicKeyPem: publicKey,
		},
	});
};
