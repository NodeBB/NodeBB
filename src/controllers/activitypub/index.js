'use strict';

const nconf = require('nconf');

const user = require('../../user');
const activitypub = require('../../activitypub');
const api = require('../../api');
const helpers = require('../helpers');

const Controller = module.exports;

Controller.profiles = require('./profiles');
Controller.topics = require('./topics');

Controller.getActor = async (req, res) => {
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

Controller.getFollowing = async (req, res) => {
	const { followingCount: totalItems } = await user.getUserFields(res.locals.uid, ['followingCount']);

	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 50;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	let orderedItems = await user.getFollowing(res.locals.uid, start, stop);
	orderedItems = orderedItems.map(({ userslug }) => `${nconf.get('url')}/user/${userslug}`);
	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems,
		orderedItems,
	});
};

Controller.getFollowers = async (req, res) => {
	const { followerCount: totalItems } = await user.getUserFields(res.locals.uid, ['followerCount']);

	const page = parseInt(req.query.page, 10) || 1;
	const resultsPerPage = 50;
	const start = Math.max(0, page - 1) * resultsPerPage;
	const stop = start + resultsPerPage - 1;

	let orderedItems = await user.getFollowers(res.locals.uid, start, stop);
	orderedItems = orderedItems.map(({ userslug }) => `${nconf.get('url')}/user/${userslug}`);
	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems,
		orderedItems,
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
	switch (req.body.type) {
		case 'Create': {
			await activitypub.inbox.create(req);
			break;
		}

		case 'Follow': {
			await activitypub.inbox.follow(req);
			break;
		}

		case 'Accept': {
			await activitypub.inbox.accept(req);
			break;
		}

		case 'Undo': {
			await activitypub.inbox.undo(req);
			break;
		}

		default: {
			console.log('Unhandled Activity!!!');
			console.log(req.body);
		}
	}

	res.sendStatus(201);
};

/**
 * Main ActivityPub verbs
 */

Controller.follow = async (req, res) => {
	const { uid: actorId } = req.params;
	helpers.formatApiResponse(200, res, await api.activitypub.follow(req, { actorId }));
};

Controller.unfollow = async (req, res) => {
	const { uid: actorId } = req.params;
	helpers.formatApiResponse(200, res, await api.activitypub.unfollow(req, { actorId }));
};
