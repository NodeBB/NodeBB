'use strict';

const nconf = require('nconf');

const meta = require('../../meta');
const privileges = require('../../privileges');
const posts = require('../../posts');
const topics = require('../../topics');
const categories = require('../../categories');
const activitypub = require('../../activitypub');
const utils = require('../../utils');

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
	const allowed = utils.isNumber(req.params.pid) && await privileges.posts.can('topics:read', req.params.pid, activitypub._constants.uid);
	const post = (await posts.getPostSummaryByPids([req.params.pid], req.uid, { stripTags: false })).pop();
	if (!allowed || !post) {
		return res.sendStatus(404);
	}

	const payload = await activitypub.mocks.note(post);
	res.status(200).json(payload);
};

Actors.topic = async function (req, res, next) {
	const allowed = await privileges.topics.can('topics:read', req.params.tid, activitypub._constants.uid);
	if (!allowed) {
		return res.sendStatus(404);
	}

	let page = parseInt(req.query.page, 10);
	const { cid, titleRaw: name, mainPid, slug, postcount } = await topics.getTopicFields(req.params.tid, ['cid', 'title', 'mainPid', 'slug', 'postcount']);
	const pageCount = Math.max(1, Math.ceil(postcount / meta.config.postsPerPage));
	let items;
	let paginate = true;

	if (!page && pageCount === 1) {
		page = 1;
		paginate = false;
	}

	if (page) {
		const invalidPagination = page < 1 || page > pageCount;
		if (invalidPagination) {
			return next();
		}

		const start = Math.max(0, ((page - 1) * meta.config.postsPerPage) - 1);
		const stop = Math.max(0, start + meta.config.postsPerPage - 1);
		const pids = await posts.getPidsFromSet(`tid:${req.params.tid}:posts`, start, stop);
		if (page === 1) {
			pids.unshift(mainPid);
			pids.length = Math.min(pids.length, meta.config.postsPerPage);
		}
		items = pids.map(pid => (utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid));
	}

	const object = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${nconf.get('url')}/topic/${req.params.tid}${paginate && page ? `?page=${page}` : ''}`,
		url: `${nconf.get('url')}/topic/${slug}`,
		name,
		type: paginate && items ? 'OrderedCollectionPage' : 'OrderedCollection',
		attributedTo: `${nconf.get('url')}/category/${cid}`,
		audience: cid !== -1 ? `${nconf.get('url')}/category/${cid}/followers` : undefined,
		totalItems: postcount,
	};

	if (items) {
		object.items = items;

		if (paginate) {
			object.partOf = `${nconf.get('url')}/topic/${req.params.tid}`;
			object.next = page < pageCount ? `${nconf.get('url')}/topic/${req.params.tid}?page=${page + 1}` : null;
			object.prev = page > 1 ? `${nconf.get('url')}/topic/${req.params.tid}?page=${page - 1}` : null;
		}
	}

	if (paginate) {
		object.first = `${nconf.get('url')}/topic/${req.params.tid}?page=1`;
		object.last = `${nconf.get('url')}/topic/${req.params.tid}?page=${pageCount}`;
	}

	res.status(200).json(object);
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
