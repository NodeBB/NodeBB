'use strict';

const nconf = require('nconf');

const meta = require('../../meta');
const posts = require('../../posts');
const categories = require('../../categories');
const activitypub = require('../../activitypub');

const Actors = module.exports;

Actors.application = async function (req, res) {
	const publicKey = await activitypub.getPublicKey('uid', 0);
	const name = meta.config.title || 'NodeBB';

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
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
	const payload = await activitypub.mocks.actors.user(req.params.uid);

	res.status(200).json(payload);
};

Actors.userBySlug = async function (req, res) {
	const { uid } = res.locals;
	req.params.uid = uid;
	delete req.params.userslug;
	Actors.user(req, res);
};

Actors.note = async function (req, res, next) {
	// technically a note isn't an actor, but it is here purely for organizational purposes.
	// but also, wouldn't it be wild if you could follow a note? lol.
	const post = (await posts.getPostSummaryByPids([req.params.pid], req.uid, { stripTags: false })).pop();
	if (!post) {
		return next('route');
	}

	const payload = await activitypub.mocks.note(post);
	res.status(200).json(payload);
};

Actors.category = async function (req, res, next) {
	const exists = await categories.exists(req.params.cid);
	if (!exists) {
		return next('route');
	}

	const payload = await activitypub.mocks.actors.category(req.params.cid);
	res.status(200).json(payload);
};
