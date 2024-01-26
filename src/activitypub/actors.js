'use strict';

const winston = require('winston');

const db = require('../database');
const utils = require('../utils');

const activitypub = module.parent.exports;

const Actors = module.exports;

Actors.assert = async (ids) => {
	// Handle single values
	if (!Array.isArray(ids)) {
		ids = [ids];
	}

	// Filter out uids if passed in
	ids = ids.filter(id => !utils.isNumber(id));

	// Filter out existing
	const exists = await db.isSortedSetMembers('usersRemote:lastCrawled', ids);
	ids = ids.filter((id, idx) => !exists[idx]);

	if (!ids.length) {
		return true;
	}

	const actors = await Promise.all(ids.map(async (id) => {
		try {
			const actor = await activitypub.get(0, id);

			// Follow counts
			const [followers, following] = await Promise.all([
				actor.followers ? activitypub.get(0, actor.followers) : { totalItems: 0 },
				actor.following ? activitypub.get(0, actor.following) : { totalItems: 0 },
			]);
			actor.followerCount = followers.totalItems;
			actor.followingCount = following.totalItems;

			// Post count
			const outbox = actor.outbox ? await activitypub.get(0, actor.outbox) : { totalItems: 0 };
			actor.postcount = outbox.totalItems;

			return actor;
		} catch (e) {
			return null;
		}
	}));

	// Build userData object for storage
	const profiles = await activitypub.mocks.profile(actors);
	const now = Date.now();

	await Promise.all([
		db.setObjectBulk(profiles.map((profile, idx) => {
			if (!profile) {
				return null;
			}
			const key = `userRemote:${ids[idx]}`;
			return [key, profile];
		}).filter(Boolean)),
		db.sortedSetAdd('usersRemote:lastCrawled', ids.map((id, idx) => (profiles[idx] ? now : null)).filter(Boolean), ids.filter((id, idx) => profiles[idx])),
	]);

	return actors.every(Boolean);
};
