'use strict';

const _ = require('lodash');
const nconf = require('nconf');
const db = require('../database');
const meta = require('../meta');
const user = require('../user');
const posts = require('../posts');
const categories = require('../categories');
const plugins = require('../plugins');
const translator = require('../translator');
const privileges = require('../privileges');
const utils = require('../utils');
const helpers = require('../helpers');

const relative_path = nconf.get('relative_path');

const Events = module.exports;

/**
 * Note: Plugins!
 *
 * You are able to define additional topic event types here.
 * Register to hook `filter:topicEvents.init` and append your custom type to the `types` object.
 * You can then log a custom topic event by calling `topics.events.log(tid, { type, uid });`
 * `uid` is optional; if you pass in a valid uid in the payload,
 * the user avatar/username will be rendered as part of the event text
 * see https://github.com/NodeBB/nodebb-plugin-question-and-answer/blob/master/library.js#L288-L306
 */
Events._types = {
	pin: {
		icon: 'fa-thumb-tack',
		translation: async (event, language) => translateSimple(event, language, 'topic:user-pinned-topic'),
	},
	unpin: {
		icon: 'fa-thumb-tack fa-rotate-90',
		translation: async (event, language) => translateSimple(event, language, 'topic:user-unpinned-topic'),
	},
	lock: {
		icon: 'fa-lock',
		translation: async (event, language) => translateSimple(event, language, 'topic:user-locked-topic'),
	},
	unlock: {
		icon: 'fa-unlock',
		translation: async (event, language) => translateSimple(event, language, 'topic:user-unlocked-topic'),
	},
	delete: {
		icon: 'fa-trash',
		translation: async (event, language) => translateSimple(event, language, 'topic:user-deleted-topic'),
	},
	restore: {
		icon: 'fa-trash-o',
		translation: async (event, language) => translateSimple(event, language, 'topic:user-restored-topic'),
	},
	move: {
		icon: 'fa-arrow-circle-right',
		translation: async (event, language) => translateEventArgs(event, language, 'topic:user-moved-topic-from', renderUser(event), `${event.fromCategory.name}`, renderTimeago(event)),
	},
	'post-queue': {
		icon: 'fa-history',
		translation: async (event, language) => translateEventArgs(event, language, 'topic:user-queued-post', renderUser(event), `${relative_path}${event.href}`, renderTimeago(event)),
	},
	backlink: {
		icon: 'fa-link',
		translation: async (event, language) => translateEventArgs(event, language, 'topic:user-referenced-topic', renderUser(event), `${relative_path}${event.href}`, renderTimeago(event)),
	},
	fork: {
		icon: 'fa-code-fork',
		translation: async (event, language) => translateEventArgs(event, language, 'topic:user-forked-topic', renderUser(event), `${relative_path}${event.href}`, renderTimeago(event)),
	},
};

Events.init = async () => {
	// Allow plugins to define additional topic event types
	const { types } = await plugins.hooks.fire('filter:topicEvents.init', { types: Events._types });
	Events._types = types;
};

async function translateEventArgs(event, language, prefix, ...args) {
	const key = getTranslationKey(event, prefix);
	const compiled = translator.compile.apply(null, [key, ...args]);
	return utils.decodeHTMLEntities(await translator.translate(compiled, language));
}

async function translateSimple(event, language, prefix) {
	return await translateEventArgs(event, language, prefix, renderUser(event), renderTimeago(event));
}

Events.translateSimple = translateSimple; // so plugins can perform translate
Events.translateEventArgs = translateEventArgs; // so plugins can perform translate

// generate `user-locked-topic-ago` or `user-locked-topic-on` based on timeago cutoff setting
function getTranslationKey(event, prefix) {
	const cutoffMs = 1000 * 60 * 60 * 24 * Math.max(0, parseInt(meta.config.timeagoCutoff, 10));
	let translationSuffix = 'ago';
	if (cutoffMs > 0 && Date.now() - event.timestamp > cutoffMs) {
		translationSuffix = 'on';
	}
	return `${prefix}-${translationSuffix}`;
}

function renderUser(event) {
	if (!event.user || event.user.system) {
		return '[[global:system-user]]';
	}
	return `${helpers.buildAvatar(event.user, '16px', true)} <a href="${relative_path}/user/${event.user.userslug}">${event.user.username}</a>`;
}

function renderTimeago(event) {
	return `<span class="timeago timeline-text" title="${event.timestampISO}"></span>`;
}

Events.get = async (tid, uid, reverse = false) => {
	if (!tid) {
		return [];
	}

	let eventIds = await db.getSortedSetRangeWithScores(`topic:${tid}:events`, 0, -1);
	const keys = eventIds.map(obj => `topicEvent:${obj.value}`);
	const timestamps = eventIds.map(obj => obj.score);
	eventIds = eventIds.map(obj => obj.value);
	let events = await db.getObjects(keys);
	events.forEach((e, idx) => {
		e.timestamp = timestamps[idx];
	});
	await addEventsFromPostQueue(tid, uid, events);
	events = await modifyEvent({ uid, events });
	if (reverse) {
		events.reverse();
	}
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

async function getCategoryInfo(cids) {
	const uniqCids = _.uniq(cids);
	const catData = await categories.getCategoriesFields(uniqCids, ['name', 'slug', 'icon', 'color', 'bgColor']);
	return _.zipObject(uniqCids, catData);
}

async function addEventsFromPostQueue(tid, uid, events) {
	const isPrivileged = await user.isPrivileged(uid);
	if (isPrivileged) {
		const queuedPosts = await posts.getQueuedPosts({ tid }, { metadata: false });
		events.push(...queuedPosts.map(item => ({
			type: 'post-queue',
			href: `/post-queue/${item.id}`,
			timestamp: item.data.timestamp || Date.now(),
			uid: item.data.uid,
		})));
	}
}

async function modifyEvent({ uid, events }) {
	const [users, fromCategories, userSettings] = await Promise.all([
		getUserInfo(events.map(event => event.uid).filter(Boolean)),
		getCategoryInfo(events.map(event => event.fromCid).filter(Boolean)),
		user.getSettings(uid),
	]);

	// Remove backlink events if backlinks are disabled
	if (meta.config.topicBacklinks !== 1) {
		events = events.filter(event => event.type !== 'backlink');
	} else {
		// remove backlinks that we dont have read permission
		const backlinkPids = events.filter(e => e.type === 'backlink')
			.map(e => e.href.split('/').pop());
		const pids = await privileges.posts.filter('topics:read', backlinkPids, uid);
		events = events.filter(
			e => e.type !== 'backlink' || pids.includes(e.href.split('/').pop())
		);
	}

	// Remove events whose types no longer exist (e.g. plugin uninstalled)
	events = events.filter(event => Events._types.hasOwnProperty(event.type));

	// Add user & metadata
	events.forEach((event) => {
		event.timestampISO = utils.toISOString(event.timestamp);
		if (event.hasOwnProperty('uid')) {
			event.user = users.get(event.uid === 'system' ? 'system' : parseInt(event.uid, 10));
		}
		if (event.hasOwnProperty('fromCid')) {
			event.fromCategory = fromCategories[event.fromCid];
		}

		Object.assign(event, Events._types[event.type]);
	});

	await Promise.all(events.map(async (event) => {
		if (Events._types[event.type].translation) {
			event.text = await Events._types[event.type].translation(event, userSettings.userLang);
		}
	}));

	// Sort events
	events.sort((a, b) => a.timestamp - b.timestamp);

	return events;
}

Events.log = async (tid, payload) => {
	const topics = require('.');
	const { type } = payload;
	const timestamp = payload.timestamp || Date.now();

	if (!Events._types.hasOwnProperty(type)) {
		throw new Error(`[[error:topic-event-unrecognized, ${type}]]`);
	} else if (!await topics.exists(tid)) {
		throw new Error('[[error:no-topic]]');
	}

	const eventId = await db.incrObjectField('global', 'nextTopicEventId');
	payload.id = eventId;

	await Promise.all([
		db.setObject(`topicEvent:${eventId}`, payload),
		db.sortedSetAdd(`topic:${tid}:events`, timestamp, eventId),
	]);
	payload.timestamp = timestamp;
	let events = await modifyEvent({
		uid: payload.uid,
		events: [payload],
	});

	({ events } = await plugins.hooks.fire('filter:topic.events.log', { events }));
	return events;
};

Events.purge = async (tid, eventIds = []) => {
	if (eventIds.length) {
		const isTopicEvent = await db.isSortedSetMembers(`topic:${tid}:events`, eventIds);
		eventIds = eventIds.filter((id, index) => isTopicEvent[index]);
		await Promise.all([
			db.sortedSetRemove(`topic:${tid}:events`, eventIds),
			db.deleteAll(eventIds.map(id => `topicEvent:${id}`)),
		]);
	} else {
		const keys = [`topic:${tid}:events`];
		const eventIds = await db.getSortedSetRange(keys[0], 0, -1);
		keys.push(...eventIds.map(id => `topicEvent:${id}`));

		await db.deleteAll(keys);
	}
};
