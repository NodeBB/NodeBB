'use strict';

const nconf = require('nconf');

const meta = require('../../meta');
const privileges = require('../../privileges');
const posts = require('../../posts');
const topics = require('../../topics');
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

Actors.note = async function (req, res) {
	// technically a note isn't an actor, but it is here purely for organizational purposes.
	// but also, wouldn't it be wild if you could follow a note? lol.
	const allowed = await privileges.posts.can('topics:read', req.params.pid, activitypub._constants.uid);
	const post = (await posts.getPostSummaryByPids([req.params.pid], req.uid, { stripTags: false })).pop();
	if (!allowed || !post) {
		return res.sendStatus(404);
	}

	const payload = await activitypub.mocks.note(post);
	res.status(200).json(payload);
};

Actors.topic = async function (req, res) {
	// When queried, a topic more or less returns the main pid's note representation
	const allowed = await privileges.topics.can('topics:read', req.params.tid, activitypub._constants.uid);
	const { mainPid, slug } = await topics.getTopicFields(req.params.tid, ['mainPid', 'slug']);
	const post = (await posts.getPostSummaryByPids([mainPid], req.uid, { stripTags: false })).pop();
	if (!allowed || !post) {
		return res.sendStatus(404);
	}

	const payload = await activitypub.mocks.note(post);
	payload.id = `${nconf.get('url')}/topic/${req.params.tid}`;
	payload.type = 'Page';
	payload.url = `${nconf.get('url')}/topic/${slug}`;
	payload.audience = `${nconf.get('url')}/category/${post.category.slug}`;

	res.status(200).json(payload);
};

Actors.category = async function (req, res, next) {
	const [exists, allowed] = await Promise.all([
		categories.exists(req.params.cid),
		privileges.categories.can('find', req.params.cid, activitypub._constants.uid),
	]);
	if (!exists || !allowed) {
		return next('route');
	}

	const payload = await activitypub.mocks.actors.category(req.params.cid);
	res.status(200).json(payload);
};
