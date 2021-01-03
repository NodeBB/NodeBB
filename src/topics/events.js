'use strict';

const db = require('../database');
const plugins = require('../plugins');

const Events = module.exports;

Events._types = {
	pin: {
		icon: 'fa-thumb-tack',
		text: '[[topic:pinned]]',
	},
	pin_expiry: {
		icon: 'fa-thumb-tack',
		text: '[[topic:pinned-with-expiry]]',
	},
	unpin: {
		icon: 'fa-thumb-tack',
		text: '[[topic:unpinned]]',
	},
	lock: {
		icon: 'fa-lock',
		text: '[[topic:locked]]',
	},
	unlock: {
		icon: 'fa-unlock',
		text: '[[topic:unlocked]]',
	},
	delete: {
		icon: 'fa-trash',
		text: '[[topic:deleted]]',
	},
	restore: {
		icon: 'fa-trash-o',
		text: '[[topic:restored]]',
	},
};
Events._ready = false;

Events.init = async () => {
	if (!Events._ready) {
		// Allow plugins to define additional topic event types
		const { types } = await plugins.hooks.fire('filter:topicEvents.init', { types: Events._types });
		Events._types = types;
		Events._ready = true;
	}
};

Events.get = async (tid) => {
	await Events.init();
	const topics = require('.');

	if (!await topics.exists(tid)) {
		throw new Error('[[error:no-topic]]');
	}

	const eventIds = await db.getSortedSetRangeWithScores(`topic:${tid}:events`, 0, -1);
	const keys = eventIds.map(obj => `topicEvent:${obj.value}`);
	const timestamps = eventIds.map(obj => obj.score);
	const events = await db.getObjects(keys);
	events.forEach((event, idx) => {
		event.id = parseInt(eventIds[idx].value, 10);
		event.timestamp = timestamps[idx];
		event.timestampISO = new Date(timestamps[idx]).toISOString();

		Object.assign(event, Events._types[event.type]);
	});

	return events;
};

Events.log = async (tid, payload) => {
	await Events.init();
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
};
