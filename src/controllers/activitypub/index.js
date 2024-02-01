'use strict';

const nconf = require('nconf');

const user = require('../../user');
const activitypub = require('../../activitypub');

const Controller = module.exports;

Controller.actors = require('./actors');
Controller.topics = require('./topics');

Controller.getFollowing = async (req, res) => {
	const { followingCount: totalItems } = await user.getUserFields(req.params.uid, ['followingCount']);
	let orderedItems;

	if (req.query.page) {
		const page = parseInt(req.query.page, 10) || 1;
		const resultsPerPage = 50;
		const start = Math.max(0, page - 1) * resultsPerPage;
		const stop = start + resultsPerPage - 1;

		orderedItems = await user.getFollowing(req.params.uid, start, stop);
		orderedItems = orderedItems.map(({ userslug }) => `${nconf.get('url')}/user/${userslug}`);
	} else {
		orderedItems = [];
	}

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems,
		orderedItems,
		// next, todo...
	});
};

Controller.getFollowers = async (req, res) => {
	const { followerCount: totalItems } = await user.getUserFields(req.params.uid, ['followerCount']);
	let orderedItems;

	if (req.query.page) {
		const page = parseInt(req.query.page, 10) || 1;
		const resultsPerPage = 50;
		const start = Math.max(0, page - 1) * resultsPerPage;
		const stop = start + resultsPerPage - 1;

		orderedItems = await user.getFollowers(req.params.uid, start, stop);
		orderedItems = orderedItems.map(({ userslug }) => `${nconf.get('url')}/user/${userslug}`);
	} else {
		orderedItems = [];
	}

	res.status(200).json({
		'@context': 'https://www.w3.org/ns/activitystreams',
		type: 'OrderedCollection',
		totalItems,
		orderedItems,
		// next, todo...
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

		case 'Like': {
			await activitypub.inbox.like(req);
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
			res.sendStatus(501);
			break;
		}
	}

	res.sendStatus(200);
};
