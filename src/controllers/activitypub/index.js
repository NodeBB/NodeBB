'use strict';

const nconf = require('nconf');

const user = require('../../user');
const activitypub = require('../../activitypub');

const Controller = module.exports;

Controller.actors = require('./actors');
Controller.profiles = require('./profiles');
Controller.topics = require('./topics');

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

		case 'Update': {
			await activitypub.inbox.update(req);
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
