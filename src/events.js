
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
	'post-change-owner',
	'topic-delete',
	'topic-restore',
	'topic-purge',
	'topic-rename',
	'password-reset',
	'user-makeAdmin',
	'user-removeAdmin',
	'user-ban',
	'user-unban',
	'user-delete',
	'user-deleteAccount',
	'user-deleteContent',
	'password-change',
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

	await Promise.all([
		db.sortedSetsAdd([
			'events:time',
			`events:time:${data.type}`,
		], data.timestamp, eid),
		db.setObject(`event:${eid}`, data),
	]);
	plugins.hooks.fire('action:events.log', { data: data });
};

events.getEvents = async function (filter, start, stop, from, to) {
	// from/to optional
	if (from === undefined) {
		from = 0;
	}
	if (to === undefined) {
		to = Date.now();
	}

	const eids = await db.getSortedSetRevRangeByScore(`events:time${filter ? `:${filter}` : ''}`, start, stop - start + 1, to, from);
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
	const sets = _.uniq(['events:time'].concat(eventData.map(e => `events:time:${e.type}`)));
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
