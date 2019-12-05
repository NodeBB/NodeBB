'use strict';

const async = require('async');
const winston = require('winston');
const cron = require('cron').CronJob;
const nconf = require('nconf');
const _ = require('lodash');

const db = require('./database');
const User = require('./user');
const groups = require('./groups');
const meta = require('./meta');
const batch = require('./batch');
const plugins = require('./plugins');
const utils = require('./utils');
const emailer = require('./emailer');

const Notifications = module.exports;

Notifications.baseTypes = [
	'notificationType_upvote',
	'notificationType_new-topic',
	'notificationType_new-reply',
	'notificationType_follow',
	'notificationType_new-chat',
	'notificationType_group-invite',
	'notificationType_group-request-membership',
];

Notifications.privilegedTypes = [
	'notificationType_new-register',
	'notificationType_post-queue',
	'notificationType_new-post-flag',
	'notificationType_new-user-flag',
];

Notifications.getAllNotificationTypes = async function () {
	const results = await plugins.fireHook('filter:user.notificationTypes', {
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

	const keys = nids.map(nid => 'notifications:' + nid);
	const notifications = await db.getObjects(keys);

	const userKeys = notifications.map(n => n && n.from);
	const usersData = await User.getUsersFields(userKeys, ['username', 'userslug', 'picture']);

	notifications.forEach(function (notification, index) {
		if (notification) {
			if (notification.path && !notification.path.startsWith('http')) {
				notification.path = nconf.get('relative_path') + notification.path;
			}
			notification.datetimeISO = utils.toISOString(notification.datetime);

			if (notification.bodyLong) {
				notification.bodyLong = utils.escapeHTML(notification.bodyLong);
			}

			notification.user = usersData[index];
			if (notification.user) {
				notification.image = notification.user.picture || null;
				if (notification.user.username === '[[global:guest]]') {
					notification.bodyShort = notification.bodyShort.replace(/([\s\S]*?),[\s\S]*?,([\s\S]*?)/, '$1, [[global:guest]], $2');
				}
			} else if (notification.image === 'brand:logo' || !notification.image) {
				notification.image = meta.config['brand:logo'] || nconf.get('relative_path') + '/logo.png';
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

	const keys = nids.map(nid => 'notifications:' + nid);
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
	const oldNotif = await db.getObject('notifications:' + data.nid);
	if (oldNotif && parseInt(oldNotif.pid, 10) === parseInt(data.pid, 10) && parseInt(oldNotif.importance, 10) > parseInt(data.importance, 10)) {
		return null;
	}
	const now = Date.now();
	data.datetime = now;
	await Promise.all([
		db.sortedSetAdd('notifications', now, data.nid),
		db.setObject('notifications:' + data.nid, data),
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

	setTimeout(function () {
		batch.processArray(uids, async function (uids) {
			await pushToUids(uids, notification);
		}, { interval: 1000 }, function (err) {
			if (err) {
				winston.error(err.stack);
			}
		});
	}, 1000);
};

async function pushToUids(uids, notification) {
	async function sendNotification(uids) {
		if (!uids.length) {
			return;
		}
		const oneWeekAgo = Date.now() - 604800000;
		const unreadKeys = uids.map(uid => 'uid:' + uid + ':notifications:unread');
		const readKeys = uids.map(uid => 'uid:' + uid + ':notifications:read');
		await db.sortedSetsAdd(unreadKeys, notification.datetime, notification.nid);
		await db.sortedSetsRemove(readKeys, notification.nid);
		await db.sortedSetsRemoveRangeByScore(unreadKeys, '-inf', oneWeekAgo);
		await db.sortedSetsRemoveRangeByScore(readKeys, '-inf', oneWeekAgo);
		const websockets = require('./socket.io');
		if (websockets.server) {
			uids.forEach(function (uid) {
				websockets.in('uid_' + uid).emit('event:new_notification', notification);
			});
		}
	}

	async function sendEmail(uids) {
		// Update CTA messaging (as not all notification types need custom text)
		if (['new-reply', 'new-chat'].includes(notification.type)) {
			notification['cta-type'] = notification.type;
		}

		await async.eachLimit(uids, 3, function (uid, next) {
			emailer.send('notification', uid, {
				path: notification.path,
				notification_url: notification.path.startsWith('http') ? notification.path : nconf.get('url') + notification.path,
				subject: utils.stripHTMLTags(notification.subject || '[[notifications:new_notification]]'),
				intro: utils.stripHTMLTags(notification.bodyShort),
				body: notification.bodyLong || '',
				notification: notification,
				showUnsubscribe: true,
			}, next);
		});
	}

	async function getUidsBySettings(uids) {
		const uidsToNotify = [];
		const uidsToEmail = [];
		const usersSettings = await User.getMultipleUserSettings(uids);
		usersSettings.forEach(function (userSettings) {
			const setting = userSettings['notificationType_' + notification.type] || 'notification';

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
	const data = await plugins.fireHook('filter:notification.push', { notification: notification, uids: uids });
	if (!data || !data.notification || !data.uids || !data.uids.length) {
		return;
	}

	notification = data.notification;
	let results = { uidsToNotify: data.uids, uidsToEmail: [] };
	if (notification.type) {
		results = await getUidsBySettings(data.uids);
	}
	await Promise.all([
		sendNotification(results.uidsToNotify),
		sendEmail(results.uidsToEmail),
	]);
	plugins.fireHook('action:notification.pushed', {
		notification: notification,
		uids: results.uidsToNotify,
		uidsNotified: results.uidsToNotify,
		uidsEmailed: results.uidsToEmail,
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

Notifications.rescind = async function (nid) {
	await Promise.all([
		db.sortedSetRemove('notifications', nid),
		db.delete('notifications:' + nid),
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
	const notification = await db.getObject('notifications:' + nid);
	if (!notification) {
		throw new Error('[[error:no-notification]]');
	}
	notification.datetime = notification.datetime || Date.now();

	await Promise.all([
		db.sortedSetRemove('uid:' + uid + ':notifications:read', nid),
		db.sortedSetAdd('uid:' + uid + ':notifications:unread', notification.datetime, nid),
	]);
};

Notifications.markReadMultiple = async function (nids, uid) {
	nids = nids.filter(Boolean);
	if (!Array.isArray(nids) || !nids.length || !(parseInt(uid, 10) > 0)) {
		return;
	}

	let notificationKeys = nids.map(nid => 'notifications:' + nid);
	let mergeIds = await db.getObjectsFields(notificationKeys, ['mergeId']);
	// Isolate mergeIds and find related notifications
	mergeIds = _.uniq(mergeIds.map(set => set.mergeId));

	const relatedNids = await Notifications.findRelated(mergeIds, 'uid:' + uid + ':notifications:unread');
	notificationKeys = _.union(nids, relatedNids).map(nid => 'notifications:' + nid);

	let notificationData = await db.getObjectsFields(notificationKeys, ['nid', 'datetime']);
	notificationData = notificationData.filter(n => n && n.nid);

	nids = notificationData.map(n => n.nid);
	const datetimes = notificationData.map(n => (n && n.datetime) || Date.now());
	await Promise.all([
		db.sortedSetRemove('uid:' + uid + ':notifications:unread', nids),
		db.sortedSetAdd('uid:' + uid + ':notifications:read', datetimes, nids),
	]);
};

Notifications.markAllRead = async function (uid) {
	const nids = await db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 99);
	await Notifications.markReadMultiple(nids, uid);
};

Notifications.prune = async function () {
	const week = 604800000;
	const cutoffTime = Date.now() - week;
	const nids = await db.getSortedSetRangeByScore('notifications', 0, 500, '-inf', cutoffTime);
	if (!nids.length) {
		return;
	}
	try {
		await Promise.all([
			db.sortedSetRemove('notifications', nids),
			db.deleteAll(nids.map(nid => 'notifications:' + nid)),
		]);

		await batch.processSortedSet('users:joindate', async function (uids) {
			await Promise.all([
				db.sortedSetsRemoveRangeByScore(uids.map(uid => 'uid:' + uid + ':notifications:unread'), '-inf', cutoffTime),
				db.sortedSetsRemoveRangeByScore(uids.map(uid => 'uid:' + uid + ':notifications:read'), '-inf', cutoffTime),
			]);
		}, { batch: 500, interval: 100 });
	} catch (err) {
		if (err) {
			winston.error('Encountered error pruning notifications', err);
		}
	}
};

Notifications.merge = async function (notifications) {
	// When passed a set of notification objects, merge any that can be merged
	const mergeIds = [
		'notifications:upvoted_your_post_in',
		'notifications:user_started_following_you',
		'notifications:user_posted_to',
		'notifications:user_flagged_post_in',
		'notifications:user_flagged_user',
		'new_register',
		'post-queue',
	];

	notifications = mergeIds.reduce(function (notifications, mergeId) {
		const isolated = notifications.filter(n => n && n.hasOwnProperty('mergeId') && n.mergeId.split('|')[0] === mergeId);
		if (isolated.length <= 1) {
			return notifications;	// Nothing to merge
		}

		// Each isolated mergeId may have multiple differentiators, so process each separately
		const differentiators = isolated.reduce(function (cur, next) {
			const differentiator = next.mergeId.split('|')[1] || 0;
			if (!cur.includes(differentiator)) {
				cur.push(differentiator);
			}

			return cur;
		}, []);

		differentiators.forEach(function (differentiator) {
			let set;
			if (differentiator === 0 && differentiators.length === 1) {
				set = isolated;
			} else {
				set = isolated.filter(n => n.mergeId === (mergeId + '|' + differentiator));
			}

			const modifyIndex = notifications.indexOf(set[0]);
			if (modifyIndex === -1 || set.length === 1) {
				return notifications;
			}

			switch (mergeId) {
			case 'notifications:upvoted_your_post_in':
			case 'notifications:user_started_following_you':
			case 'notifications:user_posted_to':
			case 'notifications:user_flagged_post_in':
			case 'notifications:user_flagged_user':
				var usernames = _.uniq(set.map(notifObj => notifObj && notifObj.user && notifObj.user.username));
				var numUsers = usernames.length;

				var title = utils.decodeHTMLEntities(notifications[modifyIndex].topicTitle || '');
				var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
				titleEscaped = titleEscaped ? (', ' + titleEscaped) : '';

				if (numUsers === 2) {
					notifications[modifyIndex].bodyShort = '[[' + mergeId + '_dual, ' + usernames.join(', ') + titleEscaped + ']]';
				} else if (numUsers > 2) {
					notifications[modifyIndex].bodyShort = '[[' + mergeId + '_multiple, ' + usernames[0] + ', ' + (numUsers - 1) + titleEscaped + ']]';
				}

				notifications[modifyIndex].path = set[set.length - 1].path;
				break;

			case 'new_register':
				notifications[modifyIndex].bodyShort = '[[notifications:' + mergeId + '_multiple, ' + set.length + ']]';
				break;
			}

			// Filter out duplicates
			notifications = notifications.filter(function (notifObj, idx) {
				if (!notifObj || !notifObj.mergeId) {
					return true;
				}

				return !(notifObj.mergeId === (mergeId + (differentiator ? '|' + differentiator : '')) && idx !== modifyIndex);
			});
		});

		return notifications;
	}, notifications);

	const data = await plugins.fireHook('filter:notifications.merge', {
		notifications: notifications,
	});
	return data && data.notifications;
};

Notifications.async = require('./promisify')(Notifications);
