'use strict';

const nconf = require('nconf');
const winston = require('winston');

const db = require('../../database');
const meta = require('../../meta');
const posts = require('../../posts');
const user = require('../../user');
const groups = require('../../groups');
const activitypub = require('../../activitypub');
const utils = require('../../utils');
const helpers = require('../helpers');

const Controller = module.exports;

Controller.actors = require('./actors');
Controller.topics = require('./topics');

Controller.fetch = async (req, res, next) => {
	// Given a `resource` query parameter, attempts to retrieve and parse it
	if (!meta.config.activitypubEnabled || !req.query.resource) {
		return next();
	}

	let url;
	try {
		url = new URL(req.query.resource);
		const result = await activitypub.probe({
			uid: req.uid,
			url: url.href,
		});

		if (typeof result === 'string') {
			return helpers.redirect(res, result);
		} else if (result) {
			const { id, type } = await activitypub.get('uid', req.uid, url.href);
			switch (true) {
				case activitypub._constants.acceptedPostTypes.includes(type): {
					return helpers.redirect(res, `/post/${encodeURIComponent(id)}`);
				}

				case activitypub._constants.acceptableActorTypes.has(type): {
					await activitypub.actors.assert(id);
					const userslug = await user.getUserField(id, 'userslug');
					return helpers.redirect(res, `/user/${userslug}`);
				}

				default:
					return helpers.redirect(res, url.href, false);
			}
		}

		// Force outgoing links page on direct access
		if (!res.locals.isAPI) {
			url = new URL(`outgoing?url=${encodeURIComponent(url.href)}`, nconf.get('url'));
		}

		helpers.redirect(res, url.href, false);
	} catch (e) {
		if (!url || !url.href) {
			return next();
		}
		activitypub.helpers.log(`[activitypub/fetch] Invalid URL received: ${url}`);
		helpers.redirect(res, url.href, false);
	}
};

Controller.getFollowing = async (req, res) => {
	const followingCount = await user.getUserField(req.params.uid, 'followingCount');
	const count = parseInt(followingCount, 10);
	const collection = await activitypub.helpers.generateCollection({
		method: user.getFollowing.bind(null, req.params.uid),
		count,
		perPage: 50,
		page: req.query.page,
		url: `${nconf.get('url')}/uid/${req.params.uid}/following`,
	});

	if (collection.hasOwnProperty('orderedItems')) {
		collection.orderedItems = collection.orderedItems.map(({ uid }) => {
			if (utils.isNumber(uid)) {
				return `${nconf.get('url')}/uid/${uid}`;
			}

			return uid;
		});
	}

	res.status(200).json(collection);
};

Controller.getFollowers = async (req, res) => {
	const followerCount = await user.getUserField(req.params.uid, 'followerCount');
	const count = parseInt(followerCount, 10);
	const collection = await activitypub.helpers.generateCollection({
		method: user.getFollowers.bind(null, req.params.uid),
		count,
		perPage: 50,
		page: req.query.page,
		url: `${nconf.get('url')}/uid/${req.params.uid}/followers`,
	});

	if (collection.hasOwnProperty('orderedItems')) {
		collection.orderedItems = collection.orderedItems.map(({ uid }) => {
			if (utils.isNumber(uid)) {
				return `${nconf.get('url')}/uid/${uid}`;
			}

			return uid;
		});
	}

	res.status(200).json(collection);
};

Controller.getOutbox = async (req, res) => {
	// Posts, shares, and votes
	const { uid } = req.params;
	let { after, before } = req.query;

	let totalItems = await db.sortedSetsCard([`uid:${uid}:posts`, `uid:${uid}:upvote`, `uid:${uid}:downvote`, `uid:${uid}:shares`]);
	totalItems = totalItems.reduce((sum, count) => {
		sum += count;
		return sum;
	}, 0);

	const perPage = 20;
	let paginate = true;
	if (totalItems <= perPage) {
		before = undefined;
		after = undefined;
		paginate = false;
	}

	let prev;
	let next;
	const partOf = paginate && (after || before) && `${nconf.get('url')}/uid/${uid}/outbox`;
	const first = paginate && !after && !before && `${nconf.get('url')}/uid/${uid}/outbox?after=${Date.now()}`;
	const last = paginate && !after && !before && `${nconf.get('url')}/uid/${uid}/outbox?before=0`;
	let activities;

	if (!paginate || after || before) {
		const limit = after ? parseInt(after, 10) - 1 : parseInt(before, 10) + 1;
		const method = after ? 'getSortedSetRevRangeByScoreWithScores' : 'getSortedSetRangeByScoreWithScores';

		const [post, upvote, downvote, share] = await Promise.all([
			db[method](`uid:${uid}:posts`, 0, 20, limit, `${after ? '-' : '+'}inf`),
			db[method](`uid:${uid}:upvote`, 0, 20, limit, `${after ? '-' : '+'}inf`),
			db[method](`uid:${uid}:downvote`, 0, 20, limit, `${after ? '-' : '+'}inf`),
			db[method](`uid:${uid}:shares`, 0, 20, limit, `${after ? '-' : '+'}inf`),
		]);
		activities = [
			post.map(post => ({ ...post, type: 'post' })),
			upvote.map(upvote => ({ ...upvote, type: 'upvote' })),
			downvote.map(downvote => ({ ...downvote, type: 'downvote' })),
			share.map(share => ({ ...share, type: 'share' })),
		].flat().sort((a, b) => b.score - a.score);
		if (after) {
			activities = activities.slice(0, 20);
		} else {
			activities = activities.slice(-20);
		}

		if (activities.length) {
			prev = `${nconf.get('url')}/uid/${uid}/outbox?before=${activities[0].score}`;
			next = `${nconf.get('url')}/uid/${uid}/outbox?after=${activities[19].score}`;

			let postsData = activities.filter((({ type }) => type === 'post'));
			postsData = await posts.getPostSummaryByPids(postsData.map(({ value }) => value), 0, { stripTags: false });
			postsData = postsData.reduce((map, postData) => {
				map.set(postData.pid, postData);
				return map;
			}, new Map());

			activities = await Promise.all(activities.map(async ({ type, value: id }) => {
				switch (type) {
					case 'post': {
						const { activity } = await activitypub.mocks.activities.create(id, 0, postsData.get(id));
						return activity;
					}

					case 'upvote': {
						return activitypub.mocks.activities.like(id, uid);
					}

					case 'downvote': {
						return activitypub.mocks.activities.dislike(id, uid);
					}

					case 'share': {
						const { activity } = await activitypub.mocks.activities.announce(id, uid);
						return activity;
					}
				}
			}));
		}
	}

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${nconf.get('url')}/uid/${uid}/outbox`,
		type: paginate ? 'OrderedCollectionPage' : 'OrderedCollection',
		totalItems,
		...(prev && { prev }),
		...(next && { next }),
		...(first && { first }),
		...(last && { last }),
		...(partOf && { partOf }),
		orderedItems: activities,
	});
};

Controller.getCategoryOutbox = async (req, res) => {
	const { cid } = req.params;
	const { page } = req.query;
	const set = `cid:${cid}:pids`;
	const count = await db.sortedSetCard(set);
	const collection = await activitypub.helpers.generateCollection({
		set,
		count,
		page,
		perPage: 20,
		url: `${nconf.get('url')}/category/${cid}/outbox`,
	});
	if (collection.orderedItems) {
		collection.orderedItems = await Promise.all(collection.orderedItems.map(async (pid) => {
			let object;
			if (utils.isNumber(pid)) {
				const { activity } = await activitypub.mocks.activities.create(pid, 0);
				object = activity;
			} else {
				object = pid;
			}

			return {
				id: `${nconf.get('url')}/post/${encodeURIComponent(pid)}#activity/announce/cid/${cid}`,
				type: 'Announce',
				actor: `${nconf.get('url')}/category/${cid}`,
				to: [activitypub._constants.publicAddress],
				cc: [`${nconf.get('url')}/category/${cid}/followers`],
				object,
			};
		}));
	}

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		...collection,
	});
};

Controller.getCategoryModerators = async (req, res) => {
	const { cid } = req.params;
	const moderatorUids = await user.getModeratorUids([cid]);
	const adminsAndGlobalMods = await groups.getMembersOfGroups(['administrators', 'Global Moderators']);
	const allModerators = [...new Set([...moderatorUids, ...adminsAndGlobalMods.flat()])];

	const actors = await Promise.all(allModerators.map(async (uid) => {
		return await activitypub.mocks.actors.user(uid);
	}));

	const collection = await activitypub.helpers.generateCollectionFromItems({
		items: actors,
		count: actors.length,
		page: 1,
		perPage: actors.length,
		url: `${nconf.get('url')}/category/${cid}/moderators`,
	});

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		...collection,
	});
};

Controller.postOutbox = async (req, res) => {
	// This is a client-to-server feature so it is deliberately not implemented at this time.
	res.sendStatus(405);
};

Controller.getInbox = async (req, res) => {
	// This is a client-to-server feature so it is deliberately not implemented at this time.
	res.sendStatus(405);
};

Controller.postInbox = async (req, res) => {
	// Note: underlying methods are internal use only, hence no exposure via src/api
	const method = String(req.body.type).toLowerCase();
	if (!activitypub.inbox.hasOwnProperty(method)) {
		activitypub.helpers.log(`[activitypub/inbox] Received Activity of type ${method} but unable to handle. Ignoring.`);
		return res.sendStatus(200);
	}

	try {
		await activitypub.inbox[method](req);
		await activitypub.analytics.receipt(req.body);
		await helpers.formatApiResponse(202, res);
	} catch (e) {
		activitypub.analytics.receiptError(req.body, e);
		if (req.body?.type && req.body?.object && req.body?.actor) {
			activitypub.inbox._reject(req.body.type, req.body.object, req.body.actor);
		} else {
			helpers.formatApiResponse(500, res, e).catch(err => winston.error(err.stack));
		}
	}
};
