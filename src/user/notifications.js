
'use strict';

var winston = require('winston');
var _ = require('lodash');

var db = require('../database');
var meta = require('../meta');
var notifications = require('../notifications');
var privileges = require('../privileges');
var plugins = require('../plugins');
var utils = require('../utils');

var UserNotifications = module.exports;

UserNotifications.get = async function (uid) {
	if (parseInt(uid, 10) <= 0) {
		return { read: [], unread: [] };
	}

	let unread = await getNotificationsFromSet('uid:' + uid + ':notifications:unread', uid, 0, 29);
	unread = unread.filter(Boolean);
	let read = [];
	if (unread.length < 30) {
		read = await getNotificationsFromSet('uid:' + uid + ':notifications:read', uid, 0, 29 - unread.length);
	}
	return {
		read: read.filter(Boolean),
		unread: unread,
	};
};

async function filterNotifications(nids, filter) {
	if (!filter) {
		return nids;
	}
	const keys = nids.map(nid => 'notifications:' + nid);
	const notifications = await db.getObjectsFields(keys, ['nid', 'type']);
	return notifications.filter(n => n && n.nid && n.type === filter).map(n => n.nid);
}

UserNotifications.getAll = async function (uid, filter) {
	let nids = await db.getSortedSetRevRange([
		'uid:' + uid + ':notifications:unread',
		'uid:' + uid + ':notifications:read',
	], 0, -1);
	nids = _.uniq(nids);
	const exists = await db.isSortedSetMembers('notifications', nids);
	var deleteNids = [];

	nids = nids.filter(function (nid, index) {
		if (!nid || !exists[index]) {
			deleteNids.push(nid);
		}
		return nid && exists[index];
	});

	await deleteUserNids(deleteNids, uid);
	return await filterNotifications(nids, filter);
};

async function deleteUserNids(nids, uid) {
	await db.sortedSetRemove([
		'uid:' + uid + ':notifications:read',
		'uid:' + uid + ':notifications:unread',
	], nids);
}

async function getNotificationsFromSet(set, uid, start, stop) {
	const nids = await db.getSortedSetRevRange(set, start, stop);
	return await UserNotifications.getNotifications(nids, uid);
}

UserNotifications.getNotifications = async function (nids, uid) {
	if (!Array.isArray(nids) || !nids.length) {
		return [];
	}

	const [notifObjs, hasRead] = await Promise.all([
		notifications.getMultiple(nids),
		db.isSortedSetMembers('uid:' + uid + ':notifications:read', nids),
	]);

	const deletedNids = [];
	let notificationData = notifObjs.filter(function (notification, index) {
		if (!notification || !notification.nid) {
			deletedNids.push(nids[index]);
		}
		if (notification) {
			notification.read = hasRead[index];
			notification.readClass = !notification.read ? 'unread' : '';
		}

		return notification && notification.path;
	});

	await deleteUserNids(deletedNids, uid);
	notificationData = await notifications.merge(notificationData);
	const result = await plugins.fireHook('filter:user.notifications.getNotifications', {
		uid: uid,
		notifications: notificationData,
	});
	return result && result.notifications;
};

UserNotifications.getUnreadInterval = async function (uid, interval) {
	const dayInMs = 1000 * 60 * 60 * 24;
	const times = {
		day: dayInMs,
		week: 7 * dayInMs,
		month: 30 * dayInMs,
	};
	if (!times[interval]) {
		return [];
	}
	const min = Date.now() - times[interval];
	const nids = await db.getSortedSetRevRangeByScore('uid:' + uid + ':notifications:unread', 0, 20, '+inf', min);
	return await UserNotifications.getNotifications(nids, uid);
};

UserNotifications.getDailyUnread = async function (uid) {
	return await UserNotifications.getUnreadInterval(uid, 'day');
};

UserNotifications.getUnreadCount = async function (uid) {
	if (parseInt(uid, 10) <= 0) {
		return 0;
	}
	let nids = await db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 99);
	nids = await notifications.filterExists(nids);
	const keys = nids.map(nid => 'notifications:' + nid);
	const notifData = await db.getObjectsFields(keys, ['mergeId']);
	const mergeIds = notifData.map(n => n.mergeId);

	// Collapse any notifications with identical mergeIds
	return mergeIds.reduce(function (count, mergeId, idx, arr) {
		// A missing (null) mergeId means that notification is counted separately.
		if (mergeId === null || idx === arr.indexOf(mergeId)) {
			count += 1;
		}

		return count;
	}, 0);
};

UserNotifications.getUnreadByField = async function (uid, field, values) {
	const nids = await db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 99);
	if (!nids.length) {
		return [];
	}
	const keys = nids.map(nid => 'notifications:' + nid);
	const notifData = await db.getObjectsFields(keys, ['nid', field]);
	const valuesSet = new Set(values.map(value => String(value)));
	return notifData.filter(n => n && n[field] && valuesSet.has(String(n[field]))).map(n => n.nid);
};

UserNotifications.deleteAll = async function (uid) {
	if (parseInt(uid, 10) <= 0) {
		return;
	}
	await db.deleteAll([
		'uid:' + uid + ':notifications:unread',
		'uid:' + uid + ':notifications:read',
	]);
};

UserNotifications.sendTopicNotificationToFollowers = async function (uid, topicData, postData) {
	try {
		let followers = await db.getSortedSetRange('followers:' + uid, 0, -1);
		followers = await privileges.categories.filterUids('read', topicData.cid, followers);
		if (!followers.length) {
			return;
		}
		let title = topicData.title;
		if (title) {
			title = utils.decodeHTMLEntities(title);
			title = title.replace(/,/g, '\\,');
		}

		const notifObj = await notifications.create({
			type: 'new-topic',
			bodyShort: '[[notifications:user_posted_topic, ' + postData.user.username + ', ' + title + ']]',
			bodyLong: postData.content,
			pid: postData.pid,
			path: '/post/' + postData.pid,
			nid: 'tid:' + postData.tid + ':uid:' + uid,
			tid: postData.tid,
			from: uid,
		});

		await notifications.push(notifObj, followers);
	} catch (err) {
		winston.error(err);
	}
};

UserNotifications.sendWelcomeNotification = async function (uid) {
	if (!meta.config.welcomeNotification) {
		return;
	}

	var path = meta.config.welcomeLink ? meta.config.welcomeLink : '#';
	const notifObj = await notifications.create({
		bodyShort: meta.config.welcomeNotification,
		path: path,
		nid: 'welcome_' + uid,
		from: meta.config.welcomeUid ? meta.config.welcomeUid : null,
	});

	await notifications.push(notifObj, [uid]);
};

UserNotifications.sendNameChangeNotification = async function (uid, username) {
	const notifObj = await notifications.create({
		bodyShort: '[[user:username_taken_workaround, ' + username + ']]',
		image: 'brand:logo',
		nid: 'username_taken:' + uid,
		datetime: Date.now(),
	});

	await notifications.push(notifObj, uid);
};

UserNotifications.pushCount = async function (uid) {
	const websockets = require('../socket.io');
	const count = await UserNotifications.getUnreadCount(uid);
	websockets.in('uid_' + uid).emit('event:notifications.updateCount', count);
};
