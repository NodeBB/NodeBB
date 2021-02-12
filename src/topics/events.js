'use strict';

const db = require('../database');
const user = require('../user');
const plugins = require('../plugins');

const Events = module.exports;

/**
 * Note: Plugins!
 *
 * You are able to define additional topic event types here.
 * Register to hook `filter:topicEvents.init` and append your custom type to the `types` object.
 * You can then log a custom topic event by calling `topics.events.log(tid, { type, uid });`
 * `uid` is optional; if you pass in a valid uid in the payload,
 * the user avatar/username will be rendered as part of the event text
 *
 */
Events._types = {
	pin: {
		icon: 'fa-thumb-tack',
		text: '[[topic:pinned-by]]',
	},
	unpin: {
		icon: 'fa-thumb-tack',
		text: '[[topic:unpinned-by]]',
	},
	lock: {
		icon: 'fa-lock',
		text: '[[topic:locked-by]]',
	},
	unlock: {
		icon: 'fa-unlock',
		text: '[[topic:unlocked-by]]',
	},
	delete: {
		icon: 'fa-trash',
		text: '[[topic:deleted-by]]',
	},
	restore: {
		icon: 'fa-trash-o',
		text: '[[topic:restored-by]]',
	},
};

Events.init = async () => {
	// Allow plugins to define additional topic event types
	const { types } = await plugins.hooks.fire('filter:topicEvents.init', { types: Events._types });
	Events._types = types;
};

Events.get = async (tid) => {
	const topics = require('.');

	if (!await topics.exists(tid)) {
		throw new Error('[[error:no-topic]]');
	}

	let eventIds = await db.getSortedSetRangeWithScores(`topic:${tid}:events`, 0, -1);
	const keys = eventIds.map(obj => `topicEvent:${obj.value}`);
	const timestamps = eventIds.map(obj => obj.score);
	eventIds = eventIds.map(obj => obj.value);
	let events = await db.getObjects(keys);
	events = await modifyEvent({ eventIds, timestamps, events });

	return events;
};

async function getUserInfo(uids) {
	uids = uids.filter((uid, idx) => !isNaN(parseInt(uid, 10)) && uids.indexOf(uid) === idx);
	const userData = await user.getUsersFields(uids, ['picture', 'username', 'userslug']);
	const userMap = userData.reduce((memo, cur) => memo.set(cur.uid, cur), new Map());
	userMap.set('system', {
		system: true,
	});

	return userMap;
}

async function modifyEvent({ eventIds, timestamps, events }) {
	const users = await getUserInfo(events.map(event => event.uid).filter(Boolean));

	// Remove events whose types no longer exist (e.g. plugin uninstalled)
	events = events.filter(event => Events._types.hasOwnProperty(event.type));

	// Add user & metadata
	events.forEach((event, idx) => {
		event.id = parseInt(eventIds[idx], 10);
		event.timestamp = timestamps[idx];
		event.timestampISO = new Date(timestamps[idx]).toISOString();
		if (event.hasOwnProperty('uid')) {
			event.user = users.get(event.uid === 'system' ? 'system' : parseInt(event.uid, 10));
		}

		Object.assign(event, Events._types[event.type]);
	});

	return events;
}

Events.log = async (tid, payload) => {
	const topics = require('.');
	const { type } = payload;
	const now = Date.now();

	if (!Events._types.hasOwnProperty(type)) {
		throw new Error(`[[error:topic-event-unrecognized, ${type}]]`);
	} else if (!await topics.exists(tid)) {
		throw new Error('[[error:no-topic]]');
	}

	const eventId = await db.incrObjectField('global', 'nextTopicEventId');

	await Promise.all([
		db.setObject(`topicEvent:${eventId}`, payload),
		db.sortedSetAdd(`topic:${tid}:events`, now, eventId),
	]);

	let events = await modifyEvent({
		eventIds: [eventId],
		timestamps: [now],
		events: [payload],
	});

	({ events } = await plugins.hooks.fire('filter:topic.events.log', { events }));
	return events;
};

Events.purge = async (tid) => {
	// Should only be called on topic purge
	const keys = [`topic:${tid}:events`];
	const eventIds = await db.getSortedSetRange(keys[0], 0, -1);
	keys.push(...eventIds.map(id => `topicEvent:${id}`));

	await db.deleteAll(keys);
};
