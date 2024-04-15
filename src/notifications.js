'use strict';


const async = require('async');
const winston = require('winston');
const cron = require('cron').CronJob;
const nconf = require('nconf');
const _ = require('lodash');

const db = require('./database');
const User = require('./user');
const posts = require('./posts');
const groups = require('./groups');
const meta = require('./meta');
const batch = require('./batch');
const plugins = require('./plugins');
const utils = require('./utils');
const emailer = require('./emailer');
const ttlCache = require('./cache/ttl');

const Notifications = module.exports;

// ttlcache for email-only chat notifications
const notificationCache = ttlCache({
	ttl: (meta.config.notificationSendDelay || 60) * 1000,
	noDisposeOnSet: true,
	dispose: sendEmail,
});

Notifications.baseTypes = [
	'notificationType_upvote',
	'notificationType_new-topic',
	'notificationType_new-topic-with-tag',
	'notificationType_new-topic-in-category',
	'notificationType_new-reply',
	'notificationType_post-edit',
	'notificationType_follow',
	'notificationType_new-chat',
	'notificationType_new-group-chat',
	'notificationType_new-public-chat',
	'notificationType_group-invite',
	'notificationType_group-leave',
	'notificationType_group-request-membership',
	'notificationType_new-reward',
];

Notifications.privilegedTypes = [
	'notificationType_new-register',
	'notificationType_post-queue',
	'notificationType_new-post-flag',
	'notificationType_new-user-flag',
];

const notificationPruneCutoff = 2592000000; // one month

const intFields = ['datetime', 'from', 'importance', 'tid', 'pid', 'roomId'];

Notifications.getAllNotificationTypes = async function () {
	const results = await plugins.hooks.fire('filter:user.notificationTypes', {
		types: Notifications.baseTypes.slice(),
		privilegedTypes: Notifications.privilegedTypes.slice(),
	});
	return results.types.concat(results.privilegedTypes);
};

Notifications.startJobs = function () {
	winston.verbose('[notifications.init] Registering jobs.');
	new cron('*/30 * * * *', Notifications.prune, null, true);
};

Notifications.get = async function (nid) {
	const notifications = await Notifications.getMultiple([nid]);
	return Array.isArray(notifications) && notifications.length ? notifications[0] : null;
};

Notifications.getMultiple = async function (nids) {
	if (!Array.isArray(nids) || !nids.length) {
		return [];
	}

	const keys = nids.map(nid => `notifications:${nid}`);
	const notifications = await db.getObjects(keys);

	const userKeys = notifications.map(n => n && n.from);
	const usersData = await User.getUsersFields(userKeys, ['username', 'userslug', 'picture']);

	notifications.forEach((notification, index) => {
		if (notification) {
			intFields.forEach((field) => {
				if (notification.hasOwnProperty(field)) {
					notification[field] = parseInt(notification[field], 10) || 0;
				}
			});
			if (notification.path && !notification.path.startsWith('http')) {
				notification.path = nconf.get('relative_path') + notification.path;
			}
			notification.datetimeISO = utils.toISOString(notification.datetime);

			if (notification.bodyLong) {
				notification.bodyLong = utils.stripHTMLTags(notification.bodyLong, ['img', 'p', 'a']);
			}

			notification.user = usersData[index];
			if (notification.user && notification.from) {
				notification.image = notification.user.picture || null;
				if (notification.user.username === '[[global:guest]]') {
					notification.bodyShort = notification.bodyShort.replace(/([\s\S]*?),[\s\S]*?,([\s\S]*?)/, '$1, [[global:guest]], $2');
				}
			} else if (notification.image === 'brand:logo' || !notification.image) {
				notification.image = meta.config['brand:logo'] || `${nconf.get('relative_path')}/logo.png`;
			}
		}
	});
	return notifications;
};

Notifications.filterExists = async function (nids) {
	const exists = await db.isSortedSetMembers('notifications', nids);
	return nids.filter((nid, idx) => exists[idx]);
};

Notifications.findRelated = async function (mergeIds, set) {
	mergeIds = mergeIds.filter(Boolean);
	if (!mergeIds.length) {
		return [];
	}
	// A related notification is one in a zset that has the same mergeId
	const nids = await db.getSortedSetRevRange(set, 0, -1);

	const keys = nids.map(nid => `notifications:${nid}`);
	const notificationData = await db.getObjectsFields(keys, ['mergeId']);
	const notificationMergeIds = notificationData.map(notifObj => String(notifObj.mergeId));
	const mergeSet = new Set(mergeIds.map(id => String(id)));
	return nids.filter((nid, idx) => mergeSet.has(notificationMergeIds[idx]));
};

Notifications.create = async function (data) {
	if (!data.nid) {
		throw new Error('[[error:no-notification-id]]');
	}
	data.importance = data.importance || 5;
	const oldNotif = await db.getObject(`notifications:${data.nid}`);
	if (
		oldNotif &&
		parseInt(oldNotif.pid, 10) === parseInt(data.pid, 10) &&
		parseInt(oldNotif.importance, 10) > parseInt(data.importance, 10)
	) {
		return null;
	}
	const now = Date.now();
	data.datetime = now;
	const result = await plugins.hooks.fire('filter:notifications.create', {
		data: data,
	});
	if (!result.data) {
		return null;
	}
	await Promise.all([
		db.sortedSetAdd('notifications', now, data.nid),
		db.setObject(`notifications:${data.nid}`, data),
	]);
	return data;
};

Notifications.push = async function (notification, uids) {
	if (!notification || !notification.nid) {
		return;
	}
	uids = Array.isArray(uids) ? _.uniq(uids) : [uids];
	if (!uids.length) {
		return;
	}

	setTimeout(() => {
		batch.processArray(uids, async (uids) => {
			await pushToUids(uids, notification);
		}, { interval: 1000, batch: 500 }, (err) => {
			if (err) {
				winston.error(err.stack);
			}
		});
	}, 500);
};

async function pushToUids(uids, notification) {
	async function sendNotification(uids) {
		if (!uids.length) {
			return;
		}
		const cutoff = Date.now() - notificationPruneCutoff;
		const unreadKeys = uids.map(uid => `uid:${uid}:notifications:unread`);
		const readKeys = uids.map(uid => `uid:${uid}:notifications:read`);
		await Promise.all([
			db.sortedSetsAdd(unreadKeys, notification.datetime, notification.nid),
			db.sortedSetsRemove(readKeys, notification.nid),
		]);
		await db.sortedSetsRemoveRangeByScore(unreadKeys.concat(readKeys), '-inf', cutoff);
		const websockets = require('./socket.io');
		if (websockets.server) {
			await Promise.all(uids.map(async (uid) => {
				await plugins.hooks.fire('filter:sockets.sendNewNoticationToUid', {
					uid,
					notification,
				});
				websockets.in(`uid_${uid}`).emit('event:new_notification', notification);
			}));
		}
	}

	async function getUidsBySettings(uids) {
		const uidsToNotify = [];
		const uidsToEmail = [];
		const usersSettings = await User.getMultipleUserSettings(uids);
		usersSettings.forEach((userSettings) => {
			const setting = userSettings[`notificationType_${notification.type}`] || 'notification';

			if (setting === 'notification' || setting === 'notificationemail') {
				uidsToNotify.push(userSettings.uid);
			}

			if (setting === 'email' || setting === 'notificationemail') {
				uidsToEmail.push(userSettings.uid);
			}
		});
		return { uidsToNotify: uidsToNotify, uidsToEmail: uidsToEmail };
	}

	// Remove uid from recipients list if they have blocked the user triggering the notification
	uids = await User.blocks.filterUids(notification.from, uids);
	const data = await plugins.hooks.fire('filter:notification.push', {
		notification,
		uids,
	});
	if (!data || !data.notification || !data.uids || !data.uids.length) {
		return;
	}

	notification = data.notification;
	let results = { uidsToNotify: data.uids, uidsToEmail: [] };
	if (notification.type) {
		results = await getUidsBySettings(data.uids);
	}
	await sendNotification(results.uidsToNotify);
	const delayNotificationTypes = ['new-chat', 'new-group-chat', 'new-public-chat'];
	if (delayNotificationTypes.includes(notification.type)) {
		const cacheKey = `${notification.mergeId}|${results.uidsToEmail.join(',')}`;
		if (notificationCache.has(cacheKey)) {
			const payload = notificationCache.get(cacheKey);
			notification.bodyLong = [payload.notification.bodyLong, notification.bodyLong].join('\n');
		}
		notificationCache.set(cacheKey, { uids: results.uidsToEmail, notification });
	} else {
		await sendEmail({ uids: results.uidsToEmail, notification });
	}

	plugins.hooks.fire('action:notification.pushed', {
		notification,
		uids: results.uidsToNotify,
		uidsNotified: results.uidsToNotify,
		uidsEmailed: results.uidsToEmail,
	});
}

async function sendEmail({ uids, notification }, mergeId, reason) {
	// Only act on cache item expiry
	if (reason && reason !== 'stale') {
		return;
	}

	// Update CTA messaging (as not all notification types need custom text)
	if (['new-reply', 'new-chat'].includes(notification.type)) {
		notification['cta-type'] = notification.type;
	}
	let body = notification.bodyLong || '';
	if (meta.config.removeEmailNotificationImages) {
		body = body.replace(/<img[^>]*>/, '');
	}
	body = posts.relativeToAbsolute(body, posts.urlRegex);
	body = posts.relativeToAbsolute(body, posts.imgRegex);
	let errorLogged = false;
	await async.eachLimit(uids, 3, async (uid) => {
		await emailer.send('notification', uid, {
			path: notification.path,
			notification_url: notification.path.startsWith('http') ? notification.path : nconf.get('url') + notification.path,
			subject: utils.stripHTMLTags(notification.subject || '[[notifications:new-notification]]'),
			intro: utils.stripHTMLTags(notification.bodyShort),
			body: body,
			notification: notification,
			showUnsubscribe: true,
		}).catch((err) => {
			if (!errorLogged) {
				winston.error(`[emailer.send] ${err.stack}`);
				errorLogged = true;
			}
		});
	});
}

Notifications.pushGroup = async function (notification, groupName) {
	if (!notification) {
		return;
	}
	const members = await groups.getMembers(groupName, 0, -1);
	await Notifications.push(notification, members);
};

Notifications.pushGroups = async function (notification, groupNames) {
	if (!notification) {
		return;
	}
	let groupMembers = await groups.getMembersOfGroups(groupNames);
	groupMembers = _.uniq(_.flatten(groupMembers));
	await Notifications.push(notification, groupMembers);
};

Notifications.rescind = async function (nids) {
	nids = Array.isArray(nids) ? nids : [nids];
	await Promise.all([
		db.sortedSetRemove('notifications', nids),
		db.deleteAll(nids.map(nid => `notifications:${nid}`)),
	]);
};

Notifications.markRead = async function (nid, uid) {
	if (parseInt(uid, 10) <= 0 || !nid) {
		return;
	}
	await Notifications.markReadMultiple([nid], uid);
};

Notifications.markUnread = async function (nid, uid) {
	if (!(parseInt(uid, 10) > 0) || !nid) {
		return;
	}
	const notification = await db.getObject(`notifications:${nid}`);
	if (!notification) {
		throw new Error('[[error:no-notification]]');
	}
	notification.datetime = notification.datetime || Date.now();

	await Promise.all([
		db.sortedSetRemove(`uid:${uid}:notifications:read`, nid),
		db.sortedSetAdd(`uid:${uid}:notifications:unread`, notification.datetime, nid),
	]);
};

Notifications.markReadMultiple = async function (nids, uid) {
	nids = nids.filter(Boolean);
	if (!Array.isArray(nids) || !nids.length || !(parseInt(uid, 10) > 0)) {
		return;
	}

	let notificationKeys = nids.map(nid => `notifications:${nid}`);
	let mergeIds = await db.getObjectsFields(notificationKeys, ['mergeId']);
	// Isolate mergeIds and find related notifications
	mergeIds = _.uniq(mergeIds.map(set => set.mergeId));

	const relatedNids = await Notifications.findRelated(mergeIds, `uid:${uid}:notifications:unread`);
	notificationKeys = _.union(nids, relatedNids).map(nid => `notifications:${nid}`);

	let notificationData = await db.getObjectsFields(notificationKeys, ['nid', 'datetime']);
	notificationData = notificationData.filter(n => n && n.nid);

	nids = notificationData.map(n => n.nid);
	const datetimes = notificationData.map(n => (n && n.datetime) || Date.now());
	await Promise.all([
		db.sortedSetRemove(`uid:${uid}:notifications:unread`, nids),
		db.sortedSetAdd(`uid:${uid}:notifications:read`, datetimes, nids),
	]);
};

Notifications.markAllRead = async function (uid) {
	const nids = await db.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 99);
	await Notifications.markReadMultiple(nids, uid);
};

Notifications.prune = async function () {
	const cutoffTime = Date.now() - notificationPruneCutoff;
	const nids = await db.getSortedSetRangeByScore('notifications', 0, 500, '-inf', cutoffTime);
	if (!nids.length) {
		return;
	}
	try {
		await Promise.all([
			db.sortedSetRemove('notifications', nids),
			db.deleteAll(nids.map(nid => `notifications:${nid}`)),
		]);

		await batch.processSortedSet('users:joindate', async (uids) => {
			const unread = uids.map(uid => `uid:${uid}:notifications:unread`);
			const read = uids.map(uid => `uid:${uid}:notifications:read`);
			await db.sortedSetsRemoveRangeByScore(unread.concat(read), '-inf', cutoffTime);
		}, { batch: 500, interval: 100 });
	} catch (err) {
		if (err) {
			winston.error(`Encountered error pruning notifications\n${err.stack}`);
		}
	}
};

Notifications.merge = async function (notifications) {
	// When passed a set of notification objects, merge any that can be merged
	const mergeIds = [
		'notifications:upvoted-your-post-in',
		'notifications:user-started-following-you',
		'notifications:user-posted-to',
		'notifications:user-flagged-post-in',
		'notifications:user-flagged-user',
		'new-chat',
		'notifications:user-posted-in-public-room',
		'new-register',
		'post-queue',
	];

	notifications = mergeIds.reduce((notifications, mergeId) => {
		const isolated = notifications.filter(n => n && n.hasOwnProperty('mergeId') && n.mergeId.split('|')[0] === mergeId);
		if (isolated.length <= 1) {
			return notifications; // Nothing to merge
		}

		// Each isolated mergeId may have multiple differentiators, so process each separately
		const differentiators = isolated.reduce((cur, next) => {
			const differentiator = next.mergeId.split('|')[1] || 0;
			if (!cur.includes(differentiator)) {
				cur.push(differentiator);
			}

			return cur;
		}, []);

		differentiators.forEach((differentiator) => {
			function typeFromLength(items) {
				if (items.length === 2) {
					return 'dual';
				} else if (items.length === 3) {
					return 'triple';
				}
				return 'multiple';
			}
			let set;
			if (differentiator === 0 && differentiators.length === 1) {
				set = isolated;
			} else {
				set = isolated.filter(n => n.mergeId === (`${mergeId}|${differentiator}`));
			}

			const modifyIndex = notifications.indexOf(set[0]);
			if (modifyIndex === -1 || set.length === 1) {
				return notifications;
			}
			const notifObj = notifications[modifyIndex];
			switch (mergeId) {
				case 'new-chat': {
					const { roomId, roomName, type, user } = set[0];
					const isGroupChat = type === 'new-group-chat';
					notifObj.bodyShort = isGroupChat || (roomName !== `[[modules:chat.room-id, ${roomId}]]`) ?
						`[[notifications:new-messages-in, ${set.length}, ${roomName}]]` :
						`[[notifications:new-messages-from, ${set.length}, ${user.displayname}]]`;
					break;
				}

				case 'notifications:user-posted-in-public-room': {
					const usernames = _.uniq(set.map(notifObj => notifObj && notifObj.user && notifObj.user.displayname));
					if (usernames.length === 2 || usernames.length === 3) {
						notifObj.bodyShort = `[[${mergeId}-${typeFromLength(usernames)}, ${usernames.join(', ')}, ${notifObj.roomIcon}, ${notifObj.roomName}]]`;
					} else if (usernames.length > 3) {
						notifObj.bodyShort = `[[${mergeId}-${typeFromLength(usernames)}, ${usernames.slice(0, 2).join(', ')}, ${usernames.length - 2}, ${notifObj.roomIcon}, ${notifObj.roomName}]]`;
					}

					notifObj.path = set[set.length - 1].path;
					break;
				}
				case 'notifications:upvoted-your-post-in':
				case 'notifications:user-started-following-you':
				case 'notifications:user-posted-to':
				case 'notifications:user-flagged-post-in':
				case 'notifications:user-flagged-user': {
					const usernames = _.uniq(set.map(notifObj => notifObj && notifObj.user && notifObj.user.username));
					const numUsers = usernames.length;

					const title = utils.decodeHTMLEntities(notifications[modifyIndex].topicTitle || '');
					let titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
					titleEscaped = titleEscaped ? (`, ${titleEscaped}`) : '';

					if (numUsers === 2 || numUsers === 3) {
						notifications[modifyIndex].bodyShort = `[[${mergeId}-${typeFromLength(usernames)}, ${usernames.join(', ')}${titleEscaped}]]`;
					} else if (numUsers > 2) {
						notifications[modifyIndex].bodyShort = `[[${mergeId}-${typeFromLength(usernames)}, ${usernames.slice(0, 2).join(', ')}, ${numUsers - 2}${titleEscaped}]]`;
					}

					notifications[modifyIndex].path = set[set.length - 1].path;
				} break;

				case 'new-register':
					notifications[modifyIndex].bodyShort = `[[notifications:${mergeId}-multiple, ${set.length}]]`;
					break;
			}

			// Filter out duplicates
			notifications = notifications.filter((notifObj, idx) => {
				if (!notifObj || !notifObj.mergeId) {
					return true;
				}

				return !(notifObj.mergeId === (mergeId + (differentiator ? `|${differentiator}` : '')) && idx !== modifyIndex);
			});
		});

		return notifications;
	}, notifications);

	const data = await plugins.hooks.fire('filter:notifications.merge', {
		notifications: notifications,
	});
	return data && data.notifications;
};

require('./promisify')(Notifications);
