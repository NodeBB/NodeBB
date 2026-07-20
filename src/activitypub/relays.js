'use strict';

const nconf = require('nconf');

const db = require('../database');

const activitypub = module.parent.exports;
const Relays = module.exports;

Relays.is = async (actor) => {
	return db.isSortedSetMember('relays:createtime', actor);
};

Relays.list = async () => {
	let relays = await db.getSortedSetMembersWithScores('relays:state');
	relays = relays.reduce((memo, { value, score }) => {
		let label = '[[admin/settings/activitypub:relays.state-0]]';
		switch(score) {
			case 1: {
				label = '[[admin/settings/activitypub:relays.state-1]]';
				break;
			}

			case 2: {
				label = '[[admin/settings/activitypub:relays.state-2]]';
				break;
			}
		}

		memo.push({
			url: value,
			state: score,
			label,
		});

		return memo;
	}, []);

	return relays;
};

Relays.add = async (url) => {
	const now = Date.now();
	await activitypub.send('uid', 0, url, {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://pleroma.example/schemas/litepub-0.1.jsonld',
		],
		id: `${nconf.get('url')}/actor#activity/follow/${encodeURIComponent(url)}/${now}`,
		type: 'Follow',
		to: [url],
		object: url,
		state: 'pending',
	});

	await Promise.all([
		db.sortedSetAdd('relays:createtime', now, url),
		db.sortedSetAdd('relays:state', 0, url),
	]);
};

Relays.remove = async (url) => {
	const now = new Date();
	const createtime = await db.sortedSetScore('relays:createtime', url);
	if (!createtime) {
		throw new Error('[[error:invalid-data]]');
	}

	await activitypub.send('uid', 0, url, {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			'https://pleroma.example/schemas/litepub-0.1.jsonld',
		],
		id: `${nconf.get('url')}/actor#activity/undo:follow/${encodeURIComponent(url)}/${now.getTime()}`,
		type: 'Undo',
		to: [url],
		published: now.toISOString(),
		object: {
			'@context': [
				'https://www.w3.org/ns/activitystreams',
				'https://pleroma.example/schemas/litepub-0.1.jsonld',
			],
			id: `${nconf.get('url')}/actor#activity/follow/${encodeURIComponent(url)}/${createtime}`,
			type: 'Follow',
			actor: `${nconf.get('url')}/actor`,
			to: [url],
			object: url,
			state: 'cancelled',
		},
	});

	await Promise.all([
		db.sortedSetRemove('relays:createtime', url),
		db.sortedSetRemove('relays:state', url),
	]);
};

Relays.handshake = async (body) => {
	const now = new Date();
	const { type, actor } = body;

	// Resolve the original Follow activity
	// If type is 'Follow', the activity is in body.object
	// If type is 'Accept', the activity is in body.object.object
	const followActivity = type === 'Follow' ? body.object : body.object?.object;

	if (!followActivity) {
		throw new Error('[[error:api.400]]');
	}

	// Check if NodeBB is the target of the follow
	const target = typeof followActivity === 'object' ? followActivity.id : followActivity;
	if (target === `${nconf.get('url')}/actor`) {
		await Relays.addFollower(actor);

		if (type === 'Follow') {
			await activitypub.send('uid', 0, actor, {
				'@context': [
					'https://www.w3.org/ns/activitystreams',
					'https://pleroma.example/schemas/litepub-0.1.jsonld',
				],
				id: `${nconf.get('url')}/actor#activity/accept/${encodeURIComponent(actor)}/${now.getTime()}`,
				type: 'Accept',
				to: [actor],
				published: now.toISOString(),
				object: followActivity,
			});
		}
		return;
	}

	// Confirm relay was added (NodeBB is the follower)
	const exists = await db.isSortedSetMember('relays:createtime', actor);
	if (!exists) {
		throw new Error('[[error:api.400]]');
	}

	if (type === 'Follow') {
		await db.sortedSetIncrBy('relays:state', 1, actor);
		await activitypub.send('uid', 0, actor, {
			'@context': [
				'https://www.w3.org/ns/activitystreams',
				'https://pleroma.example/schemas/litepub-0.1.jsonld',
			],
			id: `${nconf.get('url')}/actor#activity/accept/${encodeURIComponent(actor)}/${now.getTime()}`,
			type: 'Accept',
			to: [actor],
			published: now.toISOString(),
			object: body,
		});
	} else if (type === 'Accept') {
		await db.sortedSetIncrBy('relays:state', 1, actor);
	} else {
		throw new Error('[[error:api.400]]');
	}
};

Relays.addFollower = async (actor) => {
	await db.sortedSetAdd('relays:followers', Date.now(), actor);
};

Relays.removeFollower = async (actor) => {
	await db.sortedSetRemove('relays:followers', actor);
};

Relays.getFollowers = async () => {
	return db.getSortedSetMembers('relays:followers');
};

Relays.broadcast = async (payload) => {
	const followers = await Relays.getFollowers();
	if (followers.length === 0) return;

	await activitypub.send('uid', 0, followers, payload);
};
