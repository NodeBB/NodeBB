'use strict';

const nconf = require('nconf');
const winston = require('winston');

const meta = require('../../meta');
const user = require('../../user');
const activitypub = require('../../activitypub');
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
			const { id, type } = await activitypub.get('uid', req.uid || 0, url.href);
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
	const { followingCount, followingRemoteCount } = await user.getUserFields(req.params.uid, ['followingCount', 'followingRemoteCount']);
	const totalItems = parseInt(followingCount || 0, 10) + parseInt(followingRemoteCount || 0, 10);
	let orderedItems;
	let next = (totalItems && `${nconf.get('url')}/uid/${req.params.uid}/following?page=`) || null;

	if (totalItems) {
		if (req.query.page) {
			const page = parseInt(req.query.page, 10) || 1;
			const resultsPerPage = 50;
			const start = Math.max(0, page - 1) * resultsPerPage;
			const stop = start + resultsPerPage - 1;

			orderedItems = await user.getFollowing(req.params.uid, start, stop);
			orderedItems = orderedItems.map(({ userslug }) => `${nconf.get('url')}/user/${userslug}`);
			if (stop < totalItems - 1) {
				next = `${next}${page + 1}`;
			} else {
				next = null;
			}
		} else {
			orderedItems = [];
			next = `${next}1`;
		}
	}

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems,
		orderedItems,
		next,
	});
};

Controller.getFollowers = async (req, res) => {
	const { followerCount, followerRemoteCount } = await user.getUserFields(req.params.uid, ['followerCount', 'followerRemoteCount']);
	const totalItems = parseInt(followerCount || 0, 10) + parseInt(followerRemoteCount || 0, 10);
	let orderedItems = [];
	let next = (totalItems && `${nconf.get('url')}/uid/${req.params.uid}/followers?page=`) || null;

	if (totalItems) {
		if (req.query.page) {
			const page = parseInt(req.query.page, 10) || 1;
			const resultsPerPage = 50;
			const start = Math.max(0, page - 1) * resultsPerPage;
			const stop = start + resultsPerPage - 1;

			orderedItems = await user.getFollowers(req.params.uid, start, stop);
			orderedItems = orderedItems.map(({ userslug }) => `${nconf.get('url')}/user/${userslug}`);
			if (stop < totalItems - 1) {
				next = `${next}${page + 1}`;
			} else {
				next = null;
			}
		} else {
			orderedItems = [];
			next = `${next}1`;
		}
	}

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems,
		orderedItems,
		next,
	});
};

Controller.getOutbox = async (req, res) => {
	// stub
	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems: 0,
		orderedItems: [],
	});
};

Controller.getCategoryOutbox = async (req, res) => {
	// stub
	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems: 0,
		orderedItems: [],
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
		winston.warn(`[activitypub/inbox] Received Activity of type ${method} but unable to handle. Ignoring.`);
		return res.sendStatus(501);
	}

	try {
		await activitypub.inbox[method](req);
		await activitypub.record(req.body);
		helpers.formatApiResponse(202, res);
	} catch (e) {
		helpers.formatApiResponse(500, res, e);
	}
};
