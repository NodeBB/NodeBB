'use strict';

const nconf = require('nconf');
const winston = require('winston');

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
	ids = (await Promise.all(ids.map(async (id) => {
		const originalId = id;
		if (activitypub.helpers.isWebfinger(id)) {
			const host = id.split('@')[1];
			if (host === nconf.get('url_parsed').host) { // do not assert loopback ids
				return 'loopback';
			}

			({ actorUri: id } = await activitypub.helpers.query(id));
		}
		// ensure the final id is a valid URI
		if (!id || !activitypub.helpers.isUri(id)) {
			failedWebfingerCache.set(originalId, true);
			return;
		}
		return id;
	})));

	// Webfinger failures = assertion failure
	if (!ids.every(Boolean)) {
		return false;
	}

	// Filter out loopback uris
	ids = ids.filter(uri => uri !== 'loopback' && new URL(uri).host !== nconf.get('url_parsed').host);

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

	// winston.verbose(`[activitypub/actors] Asserting ${ids.length} actor(s)`);

	// NOTE: MAKE SURE EVERY DB ADDITION HAS A CORRESPONDING REMOVAL IN ACTORS.REMOVE!

	const urlMap = new Map();
	const followersUrlMap = new Map();
	const pubKeysMap = new Map();
	let actors = await Promise.all(ids.map(async (id) => {
		try {
			// winston.verbose(`[activitypub/actors] Processing ${id}`);
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
				// winston.verbose(`[activitypub/actor.assert] Unable to retrieve follower counts for ${actor.id}`);
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
	const profiles = (await activitypub.mocks.profile(actors)).filter(Boolean);
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

		if (username !== profile.username) {
			if (uidsForCurrent[idx] !== 0) {
				memo.searchRemove.push(['ap.preferredUsername:sorted', `${username.toLowerCase()}:${profile.uid}`]);
				memo.handleRemove.push(username.toLowerCase());
			}

			memo.searchAdd.push(['ap.preferredUsername:sorted', 0, `${profile.username.toLowerCase()}:${profile.uid}`]);
			memo.handleAdd[profile.username.toLowerCase()] = profile.uid;
		}

		if (profile.fullname && fullname !== profile.fullname) {
			if (fullname && uidsForCurrent[idx] !== 0) {
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

Actors.getLocalFollowersCount = async (id) => {
	if (!activitypub.helpers.isUri(id)) {
		return false;
	}

	return await db.sortedSetCard(`followersRemote:${id}`);
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
	 * Re-crawl those that have not been updated recently
	 */
	winston.info('[actors/prune] Started scheduled pruning of remote user accounts');

	const days = parseInt(meta.config.activitypubUserPruneDays, 10);
	const timestamp = Date.now() - (1000 * 60 * 60 * 24 * days);
	const uids = await db.getSortedSetRangeByScore('usersRemote:lastCrawled', 0, -1, '-inf', timestamp);
	if (!uids.length) {
		winston.info('[actors/prune] No remote users to prune, all done.');
		return;
	}

	winston.info(`[actors/prune] Found ${uids.length} remote users last crawled more than ${days} days ago`);
	let deletionCount = 0;

	await batch.processArray(uids, async (uids) => {
		const exists = await db.exists(uids.map(uid => `userRemote:${uid}`));
		const counts = await db.sortedSetsCard(uids.map(uid => `uid:${uid}:posts`));
		await Promise.all(uids.map(async (uid, idx) => {
			if (!exists[idx]) {
				// id in zset but not asserted, handle and return early
				await db.sortedSetRemove('usersRemote:lastCrawled', uid);
				return;
			}

			const count = counts[idx];
			if (count < 1) {
				try {
					await user.deleteAccount(uid);
					deletionCount += 1;
				} catch (err) {
					winston.error(err.stack);
				}
			}
		}));
	}, {
		batch: 50,
		interval: 1000,
	});

	winston.info(`[actors/prune] ${deletionCount} remote users pruned.`);
};
