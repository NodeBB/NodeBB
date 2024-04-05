
'use strict';

const validator = require('validator');
const _ = require('lodash');

const db = require('./database');
const batch = require('./batch');
const user = require('./user');
const utils = require('./utils');
const plugins = require('./plugins');

const events = module.exports;

events.types = [
	'plugin-activate',
	'plugin-deactivate',
	'plugin-install',
	'plugin-uninstall',
	'restart',
	'build',
	'config-change',
	'settings-change',
	'category-purge',
	'privilege-change',
	'post-delete',
	'post-restore',
	'post-purge',
	'post-edit',
	'post-move',
	'post-change-owner',
	'post-queue-reply-accept',
	'post-queue-topic-accept',
	'post-queue-reply-reject',
	'post-queue-topic-reject',
	'topic-delete',
	'topic-restore',
	'topic-purge',
	'topic-rename',
	'topic-merge',
	'topic-fork',
	'topic-move',
	'topic-move-all',
	'password-reset',
	'user-makeAdmin',
	'user-removeAdmin',
	'user-ban',
	'user-unban',
	'user-mute',
	'user-unmute',
	'user-delete',
	'user-deleteAccount',
	'user-deleteContent',
	'password-change',
	'email-confirmation-sent',
	'email-change',
	'username-change',
	'ip-blacklist-save',
	'ip-blacklist-addRule',
	'registration-approved',
	'registration-rejected',
	'group-join',
	'group-request-membership',
	'group-add-member',
	'group-leave',
	'group-owner-grant',
	'group-owner-rescind',
	'group-accept-membership',
	'group-reject-membership',
	'group-invite',
	'group-invite-accept',
	'group-invite-reject',
	'group-kick',
	'theme-set',
	'export:uploads',
	'account-locked',
	'getUsersCSV',
	'chat-room-deleted',
	// To add new types from plugins, just Array.push() to this array
];

/**
 * Useful options in data: type, uid, ip, targetUid
 * Everything else gets stringified and shown as pretty JSON string
 */
events.log = async function (data) {
	const eid = await db.incrObjectField('global', 'nextEid');
	data.timestamp = Date.now();
	data.eid = eid;
	const setKeys = [
		'events:time',
		`events:time:${data.type}`,
	];
	if (data.hasOwnProperty('uid') && data.uid) {
		setKeys.push(`events:time:uid:${data.uid}`);
	}
	await Promise.all([
		db.sortedSetsAdd(setKeys, data.timestamp, eid),
		db.setObject(`event:${eid}`, data),
	]);
	plugins.hooks.fire('action:events.log', { data: data });
};

// filter, start, stop, from(optional), to(optional), uids(optional)
events.getEvents = async function (options) {
	// backwards compatibility
	if (arguments.length > 1) {
		// eslint-disable-next-line prefer-rest-params
		const args = Array.prototype.slice.call(arguments);
		options = {
			filter: args[0],
			start: args[1],
			stop: args[2],
			from: args[3],
			to: args[4],
		};
	}
	// from/to optional
	const from = options.hasOwnProperty('from') ? options.from : '-inf';
	const to = options.hasOwnProperty('to') ? options.to : '+inf';
	const { filter, start, stop, uids } = options;
	let eids = [];

	if (Array.isArray(uids)) {
		if (filter === '') {
			eids = await db.getSortedSetRevRangeByScore(
				uids.map(uid => `events:time:uid:${uid}`),
				start,
				stop === -1 ? -1 : stop - start + 1,
				to,
				from
			);
		} else {
			eids = await Promise.all(
				uids.map(
					uid => db.getSortedSetRevIntersect({
						sets: [`events:time:uid:${uid}`, `events:time:${filter}`],
						start: 0,
						stop: -1,
						weights: [1, 0],
						withScores: true,
					})
				)
			);

			eids = _.flatten(eids)
				.filter(
					i => (from === '-inf' || i.score >= from) && (to === '+inf' || i.score <= to)
				)
				.sort((a, b) => b.score - a.score)
				.slice(start, stop + 1)
				.map(i => i.value);
		}
	} else {
		eids = await db.getSortedSetRevRangeByScore(
			`events:time${filter ? `:${filter}` : ''}`,
			start,
			stop === -1 ? -1 : stop - start + 1,
			to,
			from
		);
	}

	return await events.getEventsByEventIds(eids);
};

events.getEventCount = async (options) => {
	const { filter, uids, from, to } = options;

	if (Array.isArray(uids)) {
		if (filter === '') {
			const counts = await Promise.all(
				uids.map(uid => db.sortedSetCount(`events:time:uid:${uid}`, from, to))
			);
			return counts.reduce((prev, cur) => prev + cur, 0);
		}

		const eids = await Promise.all(
			uids.map(
				uid => db.getSortedSetRevIntersect({
					sets: [`events:time:uid:${uid}`, `events:time:${filter}`],
					start: 0,
					stop: -1,
					weights: [1, 0],
					withScores: true,
				})
			)
		);

		return _.flatten(eids).filter(
			i => (from === '-inf' || i.score >= from) && (to === '+inf' || i.score <= to)
		).length;
	}

	return await db.sortedSetCount(`events:time${filter ? `:${filter}` : ''}`, from || '-inf', to);
};

events.getEventsByEventIds = async (eids) => {
	let eventsData = await db.getObjects(eids.map(eid => `event:${eid}`));
	eventsData = eventsData.filter(Boolean);
	await addUserData(eventsData, 'uid', 'user');
	await addUserData(eventsData, 'targetUid', 'targetUser');
	eventsData.forEach((event) => {
		Object.keys(event).forEach((key) => {
			if (typeof event[key] === 'string') {
				event[key] = validator.escape(String(event[key] || ''));
			}
		});
		const e = utils.merge(event);
		e.eid = undefined;
		e.uid = undefined;
		e.type = undefined;
		e.ip = undefined;
		e.user = undefined;
		event.jsonString = JSON.stringify(e, null, 4);
		event.timestampISO = new Date(parseInt(event.timestamp, 10)).toUTCString();
	});
	return eventsData;
};

async function addUserData(eventsData, field, objectName) {
	const uids = _.uniq(eventsData.map(event => event && event[field]));

	if (!uids.length) {
		return eventsData;
	}

	const [isAdmin, userData] = await Promise.all([
		user.isAdministrator(uids),
		user.getUsersFields(uids, ['username', 'userslug', 'picture']),
	]);

	const map = {};
	userData.forEach((user, index) => {
		user.isAdmin = isAdmin[index];
		map[user.uid] = user;
	});

	eventsData.forEach((event) => {
		if (map[event[field]]) {
			event[objectName] = map[event[field]];
		}
	});
	return eventsData;
}

events.deleteEvents = async function (eids) {
	const keys = eids.map(eid => `event:${eid}`);
	const eventData = await db.getObjectsFields(keys, ['type']);
	const sets = _.uniq(
		['events:time']
			.concat(eventData.map(e => `events:time:${e.type}`))
			.concat(eventData.map(e => `events:time:uid:${e.uid}`))
	);
	await Promise.all([
		db.deleteAll(keys),
		db.sortedSetRemove(sets, eids),
	]);
};

events.deleteAll = async function () {
	await batch.processSortedSet('events:time', async (eids) => {
		await events.deleteEvents(eids);
	}, { alwaysStartAt: 0, batch: 500 });
};

require('./promisify')(events);
