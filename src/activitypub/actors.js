'use strict';

const nconf = require('nconf');
const winston = require('winston');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const batch = require('../batch');
const user = require('../user');
const utils = require('../utils');
const TTLCache = require('../cache/ttl');

const failedWebfingerCache = TTLCache({
	max: 5000,
	ttl: 1000 * 60 * 10, // 10 minutes
});

const activitypub = module.parent.exports;

const Actors = module.exports;

Actors.assert = async (ids, options = {}) => {
	/**
	 * Ensures that the passed in ids or webfinger handles are stored in database.
	 * Options:
	 *   - update: boolean, forces re-fetch/process of the resolved id
	 * Return one of:
	 *   - An array of newly processed ids
	 *   - false: if input incorrect (or webfinger handle cannot resolve)
	 *   - true: no new IDs processed; all passed-in IDs present.
	 */

	// Handle single values
	if (!Array.isArray(ids)) {
		ids = [ids];
	}
	if (!ids.length) {
		return false;
	}
	// Existance in failure cache is automatic assertion failure
	if (ids.some(id => failedWebfingerCache.has(id))) {
		return false;
	}

	// Filter out uids if passed in
	ids = ids.filter(id => !utils.isNumber(id));

	// Translate webfinger handles to uris
	const hostMap = new Map();
	ids = (await Promise.all(ids.map(async (id) => {
		const originalId = id;
		if (activitypub.helpers.isWebfinger(id)) {
			const host = id.replace(/^(acct:|@)/, '').split('@')[1];
			if (host === nconf.get('url_parsed').host) { // do not assert loopback ids
				return 'loopback';
			}

			({ actorUri: id } = await activitypub.helpers.query(id));
			hostMap.set(id, host);
		}
		// ensure the final id is a valid URI
		if (!id || !activitypub.helpers.isUri(id)) {
			failedWebfingerCache.set(originalId, true);
			return;
		}
		return id;
	})));

	// Webfinger failures = assertion failure
	if (!ids.length || !ids.every(Boolean)) {
		return false;
	}

	// Filter out loopback uris
	if (!meta.config.activitypubAllowLoopback) {
		ids = ids.filter(uri => uri !== 'loopback' && new URL(uri).host !== nconf.get('url_parsed').host);
	}

	// Only assert those who haven't been seen recently (configurable), unless update flag passed in (force refresh)
	if (!options.update) {
		const upperBound = Date.now() - (1000 * 60 * 60 * 24 * meta.config.activitypubUserPruneDays);
		const lastCrawled = await db.sortedSetScores('usersRemote:lastCrawled', ids.map(id => ((typeof id === 'object' && id.hasOwnProperty('id')) ? id.id : id)));
		ids = ids.filter((id, idx) => {
			const timestamp = lastCrawled[idx];
			return !timestamp || timestamp < upperBound;
		});
	}

	if (!ids.length) {
		return true;
	}

	activitypub.helpers.log(`[activitypub/actors] Asserting ${ids.length} actor(s)`);

	// NOTE: MAKE SURE EVERY DB ADDITION HAS A CORRESPONDING REMOVAL IN ACTORS.REMOVE!

	const urlMap = new Map();
	const followersUrlMap = new Map();
	const pubKeysMap = new Map();
	let actors = await Promise.all(ids.map(async (id) => {
		try {
			activitypub.helpers.log(`[activitypub/actors] Processing ${id}`);
			const actor = (typeof id === 'object' && id.hasOwnProperty('id')) ? id : await activitypub.get('uid', 0, id, { cache: process.env.CI === 'true' });

			let typeOk = false;
			if (Array.isArray(actor.type)) {
				typeOk = actor.type.some(type => activitypub._constants.acceptableActorTypes.has(type));
			} else {
				typeOk = activitypub._constants.acceptableActorTypes.has(actor.type);
			}

			if (
				!typeOk ||
				!activitypub._constants.requiredActorProps.every(prop => actor.hasOwnProperty(prop))
			) {
				return null;
			}

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
				activitypub.helpers.log(`[activitypub/actor.assert] Unable to retrieve follower counts for ${actor.id}`);
			}

			// Save url for backreference
			const url = Array.isArray(actor.url) ? actor.url.shift() : actor.url;
			if (url && url !== actor.id) {
				urlMap.set(url, actor.id);
			}

			// Save followers url for backreference
			if (actor.hasOwnProperty('followers') && activitypub.helpers.isUri(actor.followers)) {
				followersUrlMap.set(actor.followers, actor.id);
			}

			// Public keys
			pubKeysMap.set(actor.id, actor.publicKey);

			return actor;
		} catch (e) {
			if (e.code === 'ap_get_410') {
				const exists = await user.exists(id);
				if (exists) {
					await user.deleteAccount(id);
				}
			}

			return null;
		}
	}));
	actors = actors.filter(Boolean); // remove unresolvable actors

	// Build userData object for storage
	const profiles = (await activitypub.mocks.profile(actors, hostMap)).filter(Boolean);
	const now = Date.now();

	const bulkSet = profiles.reduce((memo, profile) => {
		const key = `userRemote:${profile.uid}`;
		memo.push([key, profile], [`${key}:keys`, pubKeysMap.get(profile.uid)]);
		return memo;
	}, []);
	if (urlMap.size) {
		bulkSet.push(['remoteUrl:uid', Object.fromEntries(urlMap)]);
	}
	if (followersUrlMap.size) {
		bulkSet.push(['followersUrl:uid', Object.fromEntries(followersUrlMap)]);
	}

	const exists = await db.isSortedSetMembers('usersRemote:lastCrawled', profiles.map(p => p.uid));
	const uidsForCurrent = profiles.map((p, idx) => (exists[idx] ? p.uid : 0));
	const current = await user.getUsersFields(uidsForCurrent, ['username', 'fullname']);
	const queries = profiles.reduce((memo, profile, idx) => {
		const { username, fullname } = current[idx];

		if (options.update || username !== profile.username) {
			if (uidsForCurrent[idx] !== 0) {
				memo.searchRemove.push(['ap.preferredUsername:sorted', `${username.toLowerCase()}:${profile.uid}`]);
				memo.handleRemove.push(username.toLowerCase());
			}

			memo.searchAdd.push(['ap.preferredUsername:sorted', 0, `${profile.username.toLowerCase()}:${profile.uid}`]);
			memo.handleAdd[profile.username.toLowerCase()] = profile.uid;
		}

		if (options.update || (profile.fullname && fullname !== profile.fullname)) {
			if (fullname && uidsForCurrent[idx] !== 0) {
				memo.searchRemove.push(['ap.name:sorted', `${fullname.toLowerCase()}:${profile.uid}`]);
			}

			memo.searchAdd.push(['ap.name:sorted', 0, `${profile.fullname.toLowerCase()}:${profile.uid}`]);
		}

		return memo;
	}, { searchRemove: [], searchAdd: [], handleRemove: [], handleAdd: {} });

	// Removals
	await Promise.all([
		db.sortedSetRemoveBulk(queries.searchRemove),
		db.deleteObjectFields('handle:uid', queries.handleRemove),
	]);

	// Additions
	await Promise.all([
		db.setObjectBulk(bulkSet),
		db.sortedSetAdd('usersRemote:lastCrawled', profiles.map(() => now), profiles.map(p => p.uid)),
		db.sortedSetAddBulk(queries.searchAdd),
		db.setObject('handle:uid', queries.handleAdd),
	]);

	return actors;
};

Actors.getLocalFollowers = async (id) => {
	const response = {
		uids: new Set(),
		cids: new Set(),
	};

	if (!activitypub.helpers.isUri(id)) {
		return response;
	}

	const members = await db.getSortedSetMembers(`followersRemote:${id}`);

	members.forEach((id) => {
		if (utils.isNumber(id)) {
			response.uids.add(parseInt(id, 10));
		} else if (id.startsWith('cid|') && utils.isNumber(id.slice(4))) {
			response.cids.add(parseInt(id.slice(4), 10));
		}
	});

	return response;
};

Actors.getLocalFollowCounts = async (actors) => {
	const isArray = Array.isArray(actors);
	if (!isArray) {
		actors = [actors];
	}

	const validActors = actors.filter(actor => activitypub.helpers.isUri(actor));
	const followerKeys = validActors.map(actor => `followersRemote:${actor}`);
	const followingKeys = validActors.map(actor => `followingRemote:${actor}`);

	const [followersCounts, followingCounts] = await Promise.all([
		db.sortedSetsCard(followerKeys),
		db.sortedSetsCard(followingKeys),
	]);
	const actorToCounts = _.zipObject(validActors, validActors.map(
		(a, idx) => ({ followers: followersCounts[idx], following: followingCounts[idx] })
	));
	const results = actors.map((actor) => {
		if (!actorToCounts.hasOwnProperty(actor)) {
			return { followers: 0, following: 0 };
		}
		return {
			followers: actorToCounts[actor].followers,
			following: actorToCounts[actor].following,
		};
	});

	return isArray ? results : results[0];
};

Actors.remove = async (id) => {
	/**
	 * Remove ActivityPub related metadata pertaining to a remote id
	 *
	 * Note: don't call this directly! It is called as part of user.deleteAccount
	 */
	const exists = await db.isSortedSetMember('usersRemote:lastCrawled', id);
	if (!exists) {
		return false;
	}

	let { username, fullname, url, followersUrl } = await user.getUserFields(id, ['username', 'fullname', 'url', 'followersUrl']);
	username = username.toLowerCase();

	const bulkRemove = [
		['ap.preferredUsername:sorted', `${username}:${id}`],
	];
	if (fullname) {
		bulkRemove.push(['ap.name:sorted', `${fullname.toLowerCase()}:${id}`]);
	}

	await Promise.all([
		db.sortedSetRemoveBulk(bulkRemove),
		db.deleteObjectField('handle:uid', username),
		db.deleteObjectField('followersUrl:uid', followersUrl),
		db.deleteObjectField('remoteUrl:uid', url),
		db.delete(`userRemote:${id}:keys`),
	]);

	await Promise.all([
		db.delete(`userRemote:${id}`),
		db.sortedSetRemove('usersRemote:lastCrawled', id),
	]);
};

Actors.prune = async () => {
	/**
	 * Clear out remote user accounts that do not have content on the forum anywhere
	 */
	winston.info('[actors/prune] Started scheduled pruning of remote user accounts');

	const days = parseInt(meta.config.activitypubUserPruneDays, 10);
	const timestamp = Date.now() - (1000 * 60 * 60 * 24 * days);
	const uids = await db.getSortedSetRangeByScore('usersRemote:lastCrawled', 0, 500, '-inf', timestamp);
	if (!uids.length) {
		winston.info('[actors/prune] No remote users to prune, all done.');
		return;
	}

	winston.info(`[actors/prune] Found ${uids.length} remote users last crawled more than ${days} days ago`);
	let deletionCount = 0;
	let deletionCountNonExisting = 0;
	let notDeletedDueToLocalContent = 0;
	const notDeletedUids = [];
	await batch.processArray(uids, async (uids) => {
		const exists = await db.exists(uids.map(uid => `userRemote:${uid}`));

		const uidsThatExist = uids.filter((uid, idx) => exists[idx]);
		const uidsThatDontExist = uids.filter((uid, idx) => !exists[idx]);

		const [postCounts, roomCounts, followCounts] = await Promise.all([
			db.sortedSetsCard(uidsThatExist.map(uid => `uid:${uid}:posts`)),
			db.sortedSetsCard(uidsThatExist.map(uid => `uid:${uid}:chat:rooms`)),
			Actors.getLocalFollowCounts(uidsThatExist),
		]);

		await Promise.all(uidsThatExist.map(async (uid, idx) => {
			const { followers, following } = followCounts[idx];
			const postCount = postCounts[idx];
			const roomCount = roomCounts[idx];
			if ([postCount, roomCount, followers, following].every(metric => metric < 1)) {
				try {
					await user.deleteAccount(uid);
					deletionCount += 1;
				} catch (err) {
					winston.error(err.stack);
				}
			} else {
				notDeletedDueToLocalContent += 1;
				notDeletedUids.push(uid);
			}
		}));

		deletionCountNonExisting += uidsThatDontExist.length;
		await db.sortedSetRemove('usersRemote:lastCrawled', uidsThatDontExist);
		// update timestamp in usersRemote:lastCrawled so we don't try to delete users
		// with content over and over
		const now = Date.now();
		await db.sortedSetAdd('usersRemote:lastCrawled', notDeletedUids.map(() => now), notDeletedUids);
	}, {
		batch: 50,
		interval: 1000,
	});

	winston.info(`[actors/prune] ${deletionCount} remote users pruned. ${deletionCountNonExisting} does not exist. ${notDeletedDueToLocalContent} not deleted due to local content`);
};
