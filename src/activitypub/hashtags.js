'use strict';

const db = require('../database');

const activitypub = module.parent.exports;

const Hashtags = module.exports;

const FOLLOWED_KEY = 'ap:hashtags:followed';
const RELAY_KEY = 'ap:hashtags:relay';

const relayTemplates = {
	'relay.fedi.buzz': 'https://relay.fedi.buzz/tag/{tag}',
	'tags.pub': 'https://tags.pub/user/{tag}',
};

Hashtags.getRelay = async () => {
	return await db.get(RELAY_KEY) || 'relay.fedi.buzz';
};

Hashtags.setRelay = async (host) => {
	if (typeof host !== 'string' || !host.trim()) {
		throw new Error('[[error:invalid-data]]');
	}
	host = host.trim().toLowerCase();
	if (!relayTemplates[host]) {
		throw new Error('[[error:activitypub.hashtag.relay-not-found]]');
	}
	const oldHost = await Hashtags.getRelay();

	await db.set(RELAY_KEY, host);

	// Migrate existing follows if relay changed
	if (oldHost && oldHost !== host) {
		await Hashtags._migrateRelay(oldHost, host);
	}
};

Hashtags.getRelayOptions = () => Object.keys(relayTemplates);

Hashtags.resolveActor = (tag, relay) => {
	const template = relayTemplates[relay];
	if (!template) {
		throw new Error('[[error:activitypub.hashtag.relay-not-found]]');
	}
	return template.replace('{tag}', encodeURIComponent(tag));
};

Hashtags.follow = async (tag, cid) => {
	const relay = await Hashtags.getRelay();
	const actor = Hashtags.resolveActor(tag, relay);

	// Check if already followed
	const existing = await Hashtags.get(tag);
	if (existing) {
		return existing;
	}

	// Send Follow activity via instance actor
	await activitypub.out.follow('uid', 0, actor);

	// Store record
	const record = {
		tag,
		relay,
		actor,
		state: 'pending',
		createdAt: Date.now(),
	};
	await db.setObject(`ap:hashtag:${tag}`, record);
	await db.sortedSetAdd(FOLLOWED_KEY, Date.now(), tag);

	// Create auto-categorization rule if category provided
	if (cid) {
		await activitypub.rules.upsert('hashtag', tag, cid, 0);
	}

	return record;
};

Hashtags.unfollow = async (tag) => {
	const record = await Hashtags.get(tag);
	if (!record) {
		return false;
	}

	// Undo Follow via instance actor
	await activitypub.out.undo.follow('uid', 0, record.actor);

	// Remove auto-categorization rule
	const rules = await activitypub.rules.list();
	const rule = rules.find(r => r.type === 'hashtag' && r.value === tag);
	if (rule) {
		await activitypub.rules.delete(rule.rid);
	}

	// Remove record
	await Promise.all([
		db.delete(`ap:hashtag:${tag}`),
		db.sortedSetRemove(FOLLOWED_KEY, tag),
	]);

	return true;
};

Hashtags.list = async () => {
	const tags = await db.getSortedSetMembers(FOLLOWED_KEY);
	if (!tags.length) {
		return [];
	}

	const records = await db.getObjects(tags.map(tag => `ap:hashtag:${tag}`));

	return records.filter(Boolean).map((record) => {
		record.createdAt = parseInt(record.createdAt, 10);
		return record;
	});
};

Hashtags.get = async (tag) => {
	const exists = await db.isSortedSetMember(FOLLOWED_KEY, tag);
	if (!exists) {
		return null;
	}
	const record = await db.getObject(`ap:hashtag:${tag}`);
	if (record) {
		record.createdAt = parseInt(record.createdAt, 10);
	}
	return record;
};

Hashtags.updateState = async (actor, state) => {
	// Find record by actor URL
	const tags = await db.getSortedSetMembers(FOLLOWED_KEY);
	if (!tags.length) {
		return;
	}

	const records = await db.getObjects(tags.map(tag => `ap:hashtag:${tag}`));
	const record = records.find(r => r && r.actor === actor);

	if (!record) {
		return;
	}

	await db.setObjectField(`ap:hashtag:${record.tag}`, 'state', state);
};

Hashtags._migrateRelay = async (oldHost, newHost) => {
	const tags = await db.getSortedSetMembers(FOLLOWED_KEY);
	if (!tags.length) {
		return;
	}

	const records = await db.getObjects(tags.map(tag => `ap:hashtag:${tag}`));

	await Promise.all(records.map(async (record) => {
		if (!record || record.relay !== oldHost) {
			return;
		}

		const newActor = Hashtags.resolveActor(record.tag, newHost);

		// Undo follow on old actor
		await activitypub.out.undo.follow('uid', 0, record.actor);

		// Follow on new actor
		await activitypub.out.follow('uid', 0, newActor);

		// Update record
		await db.setObject(`ap:hashtag:${record.tag}`, {
			...record,
			relay: newHost,
			actor: newActor,
			state: 'pending',
		});
	}));
};
