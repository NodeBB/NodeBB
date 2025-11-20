'use strict';

const nconf = require('nconf');
const winston = require('winston');

const db = require('../../database');
const meta = require('../../meta');
const privileges = require('../../privileges');
const posts = require('../../posts');
const topics = require('../../topics');
const categories = require('../../categories');
const messaging = require('../../messaging');
const activitypub = require('../../activitypub');
const utils = require('../../utils');

const Actors = module.exports;

Actors.application = async function (req, res) {
	const publicKey = await activitypub.getPublicKey('uid', 0);
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
	const allowed = await privileges.posts.can('topics:read', req.params.pid, activitypub._constants.uid);
	if (!allowed) {
		return next();
	}

	// Handle requests for remote content
	if (!utils.isNumber(req.params.pid)) {
		return res.set('Location', req.params.pid).sendStatus(308);
	}

	const post = (await posts.getPostSummaryByPids([req.params.pid], req.uid, {
		parse: false,
		extraFields: ['edited'],
	})).pop();
	if (!post || post.timestamp > Date.now()) {
		return next();
	}

	const payload = await activitypub.mocks.notes.public(post);
	const { to, cc } = await activitypub.buildRecipients(payload, { pid: post.pid, uid: post.user.uid });
	payload.to = to;
	payload.cc = cc;

	res.status(200).json(payload);
};

Actors.replies = async function (req, res, next) {
	const allowed = utils.isNumber(req.params.pid) && await privileges.posts.can('topics:read', req.params.pid, activitypub._constants.uid);
	const exists = await posts.exists(req.params.pid);
	if (!allowed || !exists) {
		return res.sendStatus(404);
	}

	const page = parseInt(req.query.page, 10);
	let replies;
	try {
		replies = await activitypub.helpers.generateCollection({
			set: `pid:${req.params.pid}:replies`,
			page,
			perPage: meta.config.postsPerPage,
			url: `${nconf.get('url')}/post/${req.params.pid}/replies`,
		});
	} catch (e) {
		return next(); // invalid page; 404
	}

	// Convert pids to urls
	if (replies.orderedItems) {
		replies.orderedItems = replies.orderedItems.map(pid => (utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid));
	}

	const object = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${nconf.get('url')}/post/${req.params.pid}/replies${replies.orderedItems && page ? `?page=${page}` : ''}`,
		url: `${nconf.get('url')}/post/${req.params.pid}`,
		...replies,
	};

	res.status(200).json(object);
};

Actors.topic = async function (req, res, next) {
	const allowed = await privileges.topics.can('topics:read', req.params.tid, activitypub._constants.uid);
	if (!allowed) {
		return res.sendStatus(404);
	}

	const page = parseInt(req.query.page, 10) || undefined;
	const perPage = meta.config.postsPerPage;
	const { cid, titleRaw: name, mainPid, slug, timestamp } = await topics.getTopicFields(req.params.tid, ['cid', 'title', 'mainPid', 'slug', 'timestamp']);
	try {
		if (timestamp > Date.now()) { // Scheduled topic, no response
			return next();
		}

		let collection;
		let pids;
		try {
			// pids are used in generation of digest only.
			([collection, pids] = await Promise.all([
				activitypub.helpers.generateCollection({
					set: `tid:${req.params.tid}:posts`,
					method: posts.getPidsFromSet,
					page,
					perPage,
					url: `${nconf.get('url')}/topic/${req.params.tid}`,
				}),
				db.getSortedSetMembers(`tid:${req.params.tid}:posts`),
			]));
		} catch (e) {
			return next(); // invalid page; 404
		}
		pids.push(mainPid);
		pids = pids.map(pid => (utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid));

		// Generate digest for ETag
		const digest = activitypub.helpers.generateDigest(new Set(pids));
		const ifNoneMatch = (req.get('If-None-Match') || '').split(',').map((tag) => {
			tag = tag.trim();
			if (tag.startsWith('"') && tag.endsWith('"')) {
				return tag.slice(1, tag.length - 1);
			}

			return tag;
		});
		if (ifNoneMatch.includes(digest)) {
			return res.sendStatus(304);
		}
		res.set('ETag', digest);

		// Add OP to collection on first (or only) page
		if (page || collection.totalItems < perPage) {
			collection.orderedItems = collection.orderedItems || [];
			if (!page || page === 1) {
				collection.orderedItems.unshift(mainPid);
				collection.totalItems += 1;
			}
		}

		// Convert pids to urls
		if (collection.orderedItems) {
			collection.orderedItems = collection.orderedItems.map(pid => (utils.isNumber(pid) ? `${nconf.get('url')}/post/${pid}` : pid));
		}

		const object = {
			'@context': 'https://www.w3.org/ns/activitystreams',
			id: `${nconf.get('url')}/topic/${req.params.tid}${collection.orderedItems && page ? `?page=${page}` : ''}`,
			url: `${nconf.get('url')}/topic/${slug}`,
			name,
			attributedTo: `${nconf.get('url')}/category/${cid}`,
			audience: cid !== -1 ? `${nconf.get('url')}/category/${cid}` : undefined,
			...collection,
		};

		res.status(200).json(object);
	} catch (e) {
		winston.error(`[activitypub/actors.topic] Unable to generate topic actor: ${e.message}`);
		return next();
	}
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

Actors.message = async function (req, res) {
	// Handle requests for remote content
	if (!utils.isNumber(req.params.mid)) {
		return res.set('Location', req.params.mid).sendStatus(308);
	}

	const messageObj = await messaging.getMessageFields(req.params.mid, []);
	messageObj.content = await messaging.parse(messageObj.content, messageObj.fromuid, 0, messageObj.roomId, false);
	const payload = await activitypub.mocks.notes.private({ messageObj });
	res.status(200).json(payload);
};
