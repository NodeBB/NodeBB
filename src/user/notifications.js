
'use strict';

const winston = require('winston');
const _ = require('lodash');

const db = require('../database');
const meta = require('../meta');
const notifications = require('../notifications');
const privileges = require('../privileges');
const plugins = require('../plugins');
const tx = require('../translator');
const posts = require('../posts');
const categories = require('../categories');
const utils = require('../utils');
const user = require('./index');

const UserNotifications = module.exports;

UserNotifications.get = async function (uid) {
	if (parseInt(uid, 10) <= 0) {
		return { read: [], unread: [] };
	}
	const { hideReadNotifications } = await user.getSettings(uid);
	let [unreadNids, readNids] = await Promise.all([
		db.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 49),
		hideReadNotifications ? [] : db.getSortedSetRevRange(`uid:${uid}:notifications:read`, 0, 49),
	]);
	readNids = readNids.slice(0, 50 - unreadNids.length);
	const [unread, read] = await Promise.all([
		UserNotifications.getNotifications(unreadNids, uid, unreadNids.map(() => false)),
		UserNotifications.getNotifications(readNids, uid, readNids.map(() => true)),
	]);

	return await plugins.hooks.fire('filter:user.notifications.get', { uid, read, unread });
};

async function filterNotifications(nids, filter) {
	if (!filter) {
		return nids;
	}
	const keys = nids.map(nid => `notifications:${nid}`);
	const notifications = await db.getObjectsFields(keys, ['nid', 'type']);
	return notifications.filter(n => n && n.nid && n.type === filter).map(n => n.nid);
}

UserNotifications.getAll = async function (uid, filter) {
	const nids = await getAllNids(uid);
	return await filterNotifications(nids, filter);
};

UserNotifications.getAllWithCounts = async function (uid, filter) {
	const nids = await getAllNids(uid);
	const keys = nids.map(nid => `notifications:${nid}`);
	let notifications = await db.getObjectsFields(keys, ['nid', 'type', 'pid']);

	const postNotifications = notifications.filter(n => n && n.pid);
	const pids = _.uniq(postNotifications.map(n => String(n.pid)));
	const visiblePids = new Set(await privileges.posts.filter('topics:read', pids, uid));
	notifications = notifications.filter(n => !n.pid || visiblePids.has(String(n.pid)));

	const counts = {};
	notifications.forEach((n) => {
		if (n && n.type) {
			counts[n.type] = (counts[n.type] || 0) + 1;
		}
	});
	if (filter) {
		notifications = notifications.filter(n => n && n.nid && n.type === filter);
	}
	return { counts, nids: notifications.map(n => n.nid) };
};

async function getAllNids(uid) {
	let nids = await db.getSortedSetRevRange([
		`uid:${uid}:notifications:unread`,
		`uid:${uid}:notifications:read`,
	], 0, -1);
	nids = _.uniq(nids);
	const exists = await db.isSortedSetMembers('notifications', nids);
	const deleteNids = [];

	nids = nids.filter((nid, index) => {
		if (!nid || !exists[index]) {
			deleteNids.push(nid);
		}
		return nid && exists[index];
	});
	await deleteUserNids(deleteNids, uid);
	return nids;
}

async function deleteUserNids(nids, uid) {
	await db.sortedSetRemove([
		`uid:${uid}:notifications:read`,
		`uid:${uid}:notifications:unread`,
	], nids);
}

UserNotifications.ownsNids = async function (nids, uid) {
	const [isInRead, isInUnread] = await Promise.all([
		db.isSortedSetMembers(`uid:${uid}:notifications:read`, nids),
		db.isSortedSetMembers(`uid:${uid}:notifications:unread`, nids),
	]);
	return nids.map((nid, index) => (isInRead[index] || isInUnread[index]));
};

UserNotifications.getNotifications = async function (nids, uid, readState) {
	if (!Array.isArray(nids) || !nids.length) {
		return [];
	}

	const [notifObjs, isRead, isUnread, userSettings] = await Promise.all([
		notifications.getMultiple(nids),
		readState ? readState : db.isSortedSetMembers(`uid:${uid}:notifications:read`, nids),
		readState ? readState.map(r => !r) : db.isSortedSetMembers(`uid:${uid}:notifications:unread`, nids),
		user.getSettings(uid),
	]);

	const postNotifications = notifObjs.filter(n => n && n.pid);
	const pids = _.uniq(postNotifications.map(n => String(n.pid)));
	const visiblePids = new Set(await privileges.posts.filter('topics:read', pids, uid));

	const deletedNids = [];
	let notificationData = notifObjs.filter((notification, index) => {
		if (!notification || !notification.nid) {
			deletedNids.push(nids[index]);
		}
		if (notification) {
			if (notification.pid && !visiblePids.has(String(notification.pid))) {
				return false;
			}
			notification.read = isRead[index];
			notification.readClass = !notification.read ? 'unread' : '';
		}
		const isUsersNotification = isRead[index] || isUnread[index];
		return notification && isUsersNotification;
	});

	await deleteUserNids(deletedNids, uid);
	notificationData = await notifications.merge(notificationData);
	await Promise.all(notificationData.map(async (n) => {
		if (n?.bodyShort) {
			n.bodyShort = posts.sanitize(await tx.translate(n.bodyShort, userSettings.userLang));
		}
		if (n?.bodyLong) {
			if (n.txBodyLong) {
				n.bodyLong = await tx.translate(n.bodyLong, userSettings.userLang);
			}
			n.bodyLong = posts.sanitize(n.bodyLong);
		}
	}));

	const result = await plugins.hooks.fire('filter:user.notifications.getNotifications', {
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
	const nids = await db.getSortedSetRevRangeByScore(`uid:${uid}:notifications:unread`, 0, 20, '+inf', min);
	return await UserNotifications.getNotifications(nids, uid, nids.map(() => false));
};

UserNotifications.getDailyUnread = async function (uid) {
	return await UserNotifications.getUnreadInterval(uid, 'day');
};

UserNotifications.getUnreadCount = async function (uid) {
	if (parseInt(uid, 10) <= 0) {
		return 0;
	}
	let nids = await db.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 99);
	nids = await notifications.filterExists(nids);
	const keys = nids.map(nid => `notifications:${nid}`);
	const notifData = await db.getObjectsFields(keys, ['mergeId']);
	const mergeIds = notifData.map(n => n.mergeId);

	// Collapse any notifications with identical mergeIds
	let count = mergeIds.reduce((count, mergeId, idx, arr) => {
		// A missing (null) mergeId means that notification is counted separately.
		if (mergeId === null || idx === arr.indexOf(mergeId)) {
			count += 1;
		}

		return count;
	}, 0);

	({ count } = await plugins.hooks.fire('filter:user.notifications.getCount', { uid, count }));
	return count;
};

UserNotifications.getUnreadByField = async function (uid, field, values) {
	const nids = await db.getSortedSetRevRange(`uid:${uid}:notifications:unread`, 0, 99);
	if (!nids.length) {
		return [];
	}
	const keys = nids.map(nid => `notifications:${nid}`);
	const notifData = await db.getObjectsFields(keys, ['nid', field]);
	const valuesSet = new Set(values.map(value => String(value)));
	return notifData.filter(n => n && n[field] && valuesSet.has(String(n[field]))).map(n => n.nid);
};

UserNotifications.deleteAll = async function (uid) {
	if (parseInt(uid, 10) <= 0) {
		return;
	}
	await db.deleteAll([
		`uid:${uid}:notifications:unread`,
		`uid:${uid}:notifications:read`,
	]);
};

UserNotifications.sendTopicNotificationToFollowers = async function (uid, topicData, postData) {
	try {
		const { tid, cid, title, tags } = topicData;
		let [displayname, userFollowers, tagFollowers, categoryFollowers] = await Promise.all([
			user.getNotificationDisplayname(uid),
			// New topic notifications only sent for local-to-local follows only
			utils.isNumber(uid) ? db.getSortedSetRange(`followers:${uid}`, 0, -1) : [],
			db.getSortedSetRange(tags.map(tag => `tag:${tag.value}:followers`), 0, -1),
			db.getSortedSetRangeByScore(
				`cid:${topicData.cid}:uid:watch:state`, 0, -1,
				categories.watchStates.watching,
				'+inf'
			),
		]);

		const userFollowersSet = new Set(userFollowers);
		tagFollowers = _.uniq(tagFollowers).filter(_uid => !userFollowersSet.has(_uid) && _uid !== String(uid));
		categoryFollowers = categoryFollowers.filter(_uid => !userFollowersSet.has(_uid) && _uid !== String(uid));

		const uidsThatCanSeeTopic = new Set(
			await privileges.categories.filterUids('topics:read', cid, [
				...userFollowers, ...tagFollowers, ...categoryFollowers,
			])
		);
		userFollowers = userFollowers.filter(_uid => uidsThatCanSeeTopic.has(_uid));
		tagFollowers = tagFollowers.filter(_uid => uidsThatCanSeeTopic.has(_uid));
		categoryFollowers = categoryFollowers.filter(_uid => uidsThatCanSeeTopic.has(_uid));

		function createNotification(data) {
			return notifications.create({
				bodyLong: postData.content,
				pid: postData.pid,
				path: `/post/${encodeURIComponent(postData.pid)}`,
				tid: tid,
				from: uid,
				...data,
			});
		}

		async function sendUserNotification() {
			const notifObj = await createNotification({
				type: 'new-topic',
				nid: `tid:${tid}:uid:${uid}`,
				bodyShort: tx.compile('notifications:user-posted-topic', displayname, tx.escape(title)),
			});

			await notifications.push(notifObj, userFollowers);
		}

		async function sendTagNotification() {
			const notifBase = 'notifications:user-posted-topic-with-tag';
			let suffix = '';
			let tagArgs = tags.map(tag => tx.escape(tag.value));
			if (tagArgs.length === 2) {
				suffix = '-dual';
			} else if (tagArgs.length === 3) {
				suffix = '-triple';
			} else if (tagArgs.length > 3) {
				suffix = '-multiple';
				tagArgs = [tagArgs.join(', ')];
			}

			const notification = await createNotification({
				type: 'new-topic-with-tag',
				nid: `new_topic:tags:${tagArgs.join('.')}:tid:${tid}:uid:${uid}`,
				bodyShort: tx.compile(`${notifBase}${suffix}`, displayname, tx.escape(title), ...tagArgs),
			});
			await notifications.push(notification, tagFollowers);
		}

		async function sendCategoryNotification() {
			const categoryName = await categories.getCategoryField(cid, 'name');
			const notifBase = 'notifications:user-posted-topic-in-category';
			const notification = await createNotification({
				type: 'new-topic-in-category',
				nid: `new_topic:tid:${tid}:uid:${uid}`,
				bodyShort: tx.compile(notifBase, displayname, tx.escape(title), categoryName),
			});
			await notifications.push(notification, categoryFollowers);
		}

		await Promise.all([
			userFollowers.length && sendUserNotification(),
			tagFollowers.length && sendTagNotification(),
			categoryFollowers.length && sendCategoryNotification(),
		]);
	} catch (err) {
		winston.error(err.stack);
	}
};

UserNotifications.sendWelcomeNotification = async function (uid) {
	if (!meta.config.welcomeNotification) {
		return;
	}

	const path = meta.config.welcomeLink ? meta.config.welcomeLink : '#';
	const notifObj = await notifications.create({
		bodyShort: meta.config.welcomeNotification,
		path: path,
		nid: `welcome_${uid}`,
		from: meta.config.welcomeUid ? meta.config.welcomeUid : null,
	});

	await notifications.push(notifObj, [uid]);
};

UserNotifications.sendNameChangeNotification = async function (uid, username) {
	const notifObj = await notifications.create({
		bodyShort: tx.compile('user:username-taken-workaround', tx.escape(username)),
		image: 'brand:logo',
		nid: `username_taken:${uid}`,
	});

	await notifications.push(notifObj, [uid]);
};

UserNotifications.pushCount = async function (uid) {
	try {
		const websockets = require('../socket.io');
		const count = await UserNotifications.getUnreadCount(uid);
		websockets.in(`uid_${uid}`).emit('event:notifications.updateCount', count);
	} catch (err) {
		winston.error(err.stack);
	}
};
