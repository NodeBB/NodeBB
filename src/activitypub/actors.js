'use strict';

const winston = require('winston');

const db = require('../database');
const user = require('../user');
const utils = require('../utils');

const activitypub = module.parent.exports;

const Actors = module.exports;

Actors.assert = async (ids, options = {}) => {
	// Handle single values
	if (!Array.isArray(ids)) {
		ids = [ids];
	}

	// Filter out uids if passed in
	ids = ids.filter(id => !utils.isNumber(id));

	// Translate webfinger handles to uris
	ids = await Promise.all(ids.map(async (id) => {
		if (id.includes('@')) {
			({ actorUri: id } = await activitypub.helpers.query(id));
		}

		return id;
	}));


	// Filter out existing
	if (!options.update) {
		const exists = await db.isSortedSetMembers('usersRemote:lastCrawled', ids.map(id => ((typeof id === 'object' && id.hasOwnProperty('id')) ? id.id : id)));
		ids = ids.filter((id, idx) => !exists[idx]);
	}

	if (!ids.length) {
		return true;
	}

	winston.verbose(`[activitypub/actors] Asserting ${ids.length} actor(s)`);

	const followersUrlMap = new Map();
	const pubKeysMap = new Map();
	let actors = await Promise.all(ids.map(async (id) => {
		try {
			winston.verbose(`[activitypub/actors] Processing ${id}`);
			const actor = (typeof id === 'object' && id.hasOwnProperty('id')) ? id : await activitypub.get('uid', 0, id);

			// Follow counts
			try {
				const [followers, following] = await Promise.all([
					actor.followers ? activitypub.get('uid', 0, actor.followers) : { totalItems: 0 },
					actor.following ? activitypub.get('uid', 0, actor.following) : { totalItems: 0 },
				]);
				actor.followerCount = followers.totalItems;
				actor.followingCount = following.totalItems;
			} catch (e) {
				// no action required
				winston.verbose(`[activitypub/actor.assert] Unable to retrieve follower counts for ${actor.id}`);
			}

			// Post count
			try {
				const outbox = actor.outbox ? await activitypub.get('uid', 0, actor.outbox) : { totalItems: 0 };
				actor.postcount = outbox.totalItems;
			} catch (e) {
				// no action required
				winston.verbose(`[activitypub/actor.assert] Unable to retrieve post counts for ${actor.id}`);
			}

			// Followers url for backreference
			if (actor.hasOwnProperty('followers') && activitypub.helpers.isUri(actor.followers)) {
				followersUrlMap.set(actor.followers, actor.id);
			}

			// Public keys
			pubKeysMap.set(actor.id, actor.publicKey);

			return actor;
		} catch (e) {
			return null;
		}
	}));
	actors = actors.filter(Boolean); // remove unresolvable actors

	// Build userData object for storage
	const profiles = await activitypub.mocks.profile(actors);
	const now = Date.now();

	const bulkSet = profiles.reduce((memo, profile) => {
		const key = `userRemote:${profile.uid}`;
		memo.push([key, profile], [`${key}:keys`, pubKeysMap.get(profile.uid)]);
		return memo;
	}, []);
	if (followersUrlMap.size) {
		bulkSet.push(['followersUrl:uid', Object.fromEntries(followersUrlMap)]);
	}

	const exists = await db.isSortedSetMembers('usersRemote:lastCrawled', profiles.map(p => p.uid));
	const uidsForCurrent = profiles.map((p, idx) => (exists[idx] ? p.uid : 0));
	const current = await user.getUsersFields(uidsForCurrent, ['username', 'fullname']);
	const queries = profiles.reduce((memo, profile, idx) => {
		const { username, fullname } = current[idx];

		if (username !== profile.username) {
			if (uidsForCurrent[idx] !== 0) {
				memo.searchRemove.push(['ap.preferredUsername:sorted', `${username.toLowerCase()}:${profile.uid}`]);
				memo.handleRemove.push(username.toLowerCase());
			}

			memo.searchAdd.push(['ap.preferredUsername:sorted', 0, `${profile.username.toLowerCase()}:${profile.uid}`]);
			memo.handleAdd[profile.username.toLowerCase()] = profile.uid;
		}

		if (profile.fullname && fullname !== profile.fullname) {
			if (uidsForCurrent[idx] !== 0) {
				memo.searchRemove.push(['ap.name:sorted', `${fullname.toLowerCase()}:${profile.uid}`]);
			}

			memo.searchAdd.push(['ap.name:sorted', 0, `${profile.fullname.toLowerCase()}:${profile.uid}`]);
		}

		return memo;
	}, { searchRemove: [], searchAdd: [], handleRemove: [], handleAdd: {} });

	await Promise.all([
		db.setObjectBulk(bulkSet),
		db.sortedSetAdd('usersRemote:lastCrawled', profiles.map(() => now), profiles.map(p => p.uid)),
		db.sortedSetRemoveBulk(queries.searchRemove),
		db.sortedSetAddBulk(queries.searchAdd),
		db.deleteObjectFields('handle:uid', queries.handleRemove),
		db.setObject('handle:uid', queries.handleAdd),
	]);

	return actors;
};
