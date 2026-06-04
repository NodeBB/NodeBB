'use strict';


const assert = require('assert');
const nconf = require('nconf');
const util = require('util');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const user = require('../src/user');
const topics = require('../src/topics');
const categories = require('../src/categories');
const notifications = require('../src/notifications');
const socketNotifications = require('../src/socket.io/notifications');

const sleep = util.promisify(setTimeout);

describe('Notifications', () => {
	let uid;
	let notification;

	before(async () => {
		uid = await user.create({ username: 'poster' });
	});

	it('should fail to create notification without a nid', (done) => {
		notifications.create({}, (err) => {
			assert.equal(err.message, '[[error:no-notification-id]]');
			done();
		});
	});

	it('should create a notification', async () => {
		notification = await notifications.create({
			bodyShort: 'bodyShort',
			nid: 'notification_id',
			path: '/notification/path',
			pid: 1,
		});

		assert(notification);

		const exists = await db.exists(`notifications:${notification.nid}`);
		assert(exists);

		const isMember = await db.isSortedSetMember('notifications', notification.nid);
		assert(isMember);
	});

	it('should create a notification with a custom icon', async () => {
		const nid = 'custom-icon-notification';
		await notifications.create({
			nid: nid,
			bodyShort: 'Notification with custom icon',
			icon: 'fa-solid fa-bell',
		});
		const notifData = await notifications.get(nid);
		assert.strictEqual(notifData.user, undefined);
		assert.strictEqual(notifData.icon, 'fa-solid fa-bell');
	});

	it('should create a notification with a user icon/bgColor', async () => {
		const uid = await user.create({ username: 'iconuser' });
		const nid = 'user-icon-notification';
		await notifications.create({
			nid: nid,
			bodyShort: 'Notification with user icon',
			from: uid,
		});
		const notifData = await notifications.get(nid);
		assert.strictEqual(notifData.icon, undefined);
		assert.strictEqual(notifData.user['icon:text'], 'I');
		assert(notifData.user['icon:bgColor'].length === 7 &&
			notifData.user['icon:bgColor'].startsWith('#'));
	});

	it('should return null if pid is same and importance is lower', async () => {
		const notification = await notifications.create({
			bodyShort: 'bodyShort',
			nid: 'notification_id',
			path: '/notification/path',
			pid: 1,
			importance: 1,
		});
		assert.strictEqual(notification, null);
	});

	it('should get empty array', async () => {
		const data = await notifications.getMultiple(null);
		assert(Array.isArray(data));
		assert.equal(data.length, 0);
	});

	it('should get notifications', async () => {
		const notificationsData = await notifications.getMultiple([notification.nid]);
		assert(Array.isArray(notificationsData));
		assert(notificationsData[0]);
		assert.equal(notification.nid, notificationsData[0].nid);
	});

	it('should do nothing', async () => {
		await notifications.push(null, []);
		await notifications.push({ nid: null }, []);
		await notifications.push(notification, []);
	});

	it('should push a notification to uid', async () => {
		await notifications.push(notification, [uid]);
		await sleep(2000);

		const isMember = await db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid);
		assert(isMember);
	});

	it('should push a notification to a group', async () => {
		await notifications.pushGroup(notification, 'registered-users');
		await sleep(2000);

		const isMember = await db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid);
		assert(isMember);
	});

	it('should push a notification to groups', async () => {
		await notifications.pushGroups(notification, ['registered-users', 'administrators']);
		await sleep(2000);
		const isMember = await db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid);
		assert(isMember);
	});

	it('should not mark anything with invalid uid or nid', async () => {
		await socketNotifications.markRead({ uid: null }, null);
		await socketNotifications.markRead({ uid: uid }, null);
	});

	it('should mark a notification read', async () => {
		await socketNotifications.markRead({ uid: uid }, notification.nid);

		const isUnread = await db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid);
		assert.strictEqual(isUnread, false);
		const isRead = await db.isSortedSetMember(`uid:${uid}:notifications:read`, notification.nid);
		assert.strictEqual(isRead, true);
	});

	it('should not mark anything with invalid uid or nid', async () => {
		await socketNotifications.markUnread({ uid: null }, null);
		await socketNotifications.markUnread({ uid: uid }, null);
	});

	it('should error if notification does not exist', async () => {
		await assert.rejects(
			socketNotifications.markUnread({ uid: uid }, 123123),
			{ message: '[[error:no-notification]]' }
		);
	});

	it('should mark a notification unread', async () => {
		await socketNotifications.markUnread({ uid: uid }, notification.nid);

		const isUnread = await db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid);
		assert.strictEqual(isUnread, true);
		const isRead = await db.isSortedSetMember(`uid:${uid}:notifications:read`, notification.nid);
		assert.strictEqual(isRead, false);
		const count = await socketNotifications.getCount({ uid: uid }, null);
		assert.strictEqual(count, 1);
	});

	it('should mark all notifications read', async () => {
		await socketNotifications.markAllRead({ uid: uid }, null);
		const isUnread = await db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid);
		assert.strictEqual(isUnread, false);
		const isRead = await db.isSortedSetMember(`uid:${uid}:notifications:read`, notification.nid);
		assert.strictEqual(isRead, true);
	});

	it('should not do anything', async () => {
		await socketNotifications.markAllRead({ uid: 1000 }, null);
	});

	it('should link to the first unread post in a watched topic', async () => {
		const watcherUid = await user.create({ username: 'watcher' });
		const { cid } = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		});

		const { topicData } = await topics.post({
			uid: watcherUid,
			cid: cid,
			title: 'Test Topic Title',
			content: 'The content of test topic',
		});
		const { tid } = topicData;

		await topics.follow(tid, watcherUid);

		const { pid } = await topics.reply({
			uid: uid,
			content: 'This is the first reply.',
			tid: tid,
		});

		await topics.reply({
			uid: uid,
			content: 'This is the second reply.',
			tid: tid,
		});
		// notifications are sent asynchronously with a 1 second delay.
		await sleep(3000);
		const notifications = await user.notifications.get(watcherUid);
		assert.equal(notifications.unread.length, 1, 'there should be 1 unread notification');
		assert.equal(`${nconf.get('relative_path')}/post/${pid}`, notifications.unread[0].path, 'the notification should link to the first unread post');
	});

	it('should get notification by nid', async () => {
		const data = await socketNotifications.get({ uid: uid }, { nids: [notification.nid] });
		assert.equal(data[0].bodyShort, 'bodyShort');
		assert.equal(data[0].nid, 'notification_id');
		assert.equal(data[0].path, `${nconf.get('relative_path')}/notification/path`);
	});

	it('should get user\'s notifications', async () => {
		const data = await socketNotifications.get({ uid: uid }, {});
		assert.equal(data.unread.length, 0);
		assert.equal(data.read[0].nid, 'notification_id');
	});

	it('should error if not logged in', async () => {
		await assert.rejects(
			socketNotifications.deleteAll({ uid: 0 }, null),
			{ message: '[[error:no-privileges]]'},
		);
	});

	it('should delete all user notifications', async () => {
		await socketNotifications.deleteAll({ uid: uid }, null);
		const data = await socketNotifications.get({ uid: uid }, {});
		assert.equal(data.unread.length, 0);
		assert.equal(data.read.length, 0);
	});

	it('should return empty with falsy uid', async () => {
		const data = await user.notifications.get(0);
		assert.equal(data.read.length, 0);
		assert.equal(data.unread.length, 0);
	});

	it('should get all notifications and filter', async () => {
		const nid = 'willbefiltered';
		const notification = await notifications.create({
			bodyShort: 'bodyShort',
			nid: nid,
			path: '/notification/path',
			type: 'post',
		});

		await notifications.push(notification, [uid]);
		await sleep(3000);
		const nids = await user.notifications.getAll(uid, 'post');
		assert(nids.includes(nid));
	});

	it('should not get anything if notifications does not exist', async () => {
		const data = await user.notifications.getNotifications(['doesnotexistnid1', 'doesnotexistnid2'], uid);
		assert.deepEqual(data, []);
	});

	it('should get daily notifications', async () => {
		const data = await user.notifications.getDailyUnread(uid);
		assert.equal(data[0].nid, 'willbefiltered');
	});

	it('should return empty array for invalid interval', async () => {
		const data = await user.notifications.getUnreadInterval(uid, '2 aeons');
		assert.deepEqual(data, []);
	});

	it('should return 0 for falsy uid', async () => {
		const count = await user.notifications.getUnreadCount(0);
		assert.equal(count, 0);
	});

	it('should not do anything if uid is falsy', async () => {
		await user.notifications.deleteAll(0);
	});

	it('should send notification to followers of user when he posts', async () => {
		const followerUid = await user.create({ username: 'follower' });
		await user.follow(followerUid, uid);
		const { cid } = await categories.create({
			name: 'Test Category',
			description: 'Test category created by testing script',
		});
		await topics.post({
			uid: uid,
			cid: cid,
			title: 'Test Topic Title',
			content: 'The content of test topic',
		});
		await sleep(1100);
		const data = await user.notifications.getAll(followerUid, '');
		assert(data);
	});

	it('should send welcome notification', async () => {
		meta.config.welcomeNotification = 'welcome to the forums';
		await user.notifications.sendWelcomeNotification(uid);
		await user.notifications.sendWelcomeNotification(uid);
		await sleep(2000);

		const data = await user.notifications.getAll(uid, '');
		meta.config.welcomeNotification = '';

		assert(data.includes(`welcome_${uid}`), data);
	});

	it('should prune notifications', async () => {
		const notification = await notifications.create({
			bodyShort: 'bodyShort',
			nid: 'tobedeleted',
			path: '/notification/path',
		});

		await notifications.prune();
		const month = 2592000000;
		await db.sortedSetAdd('notifications', Date.now() - (2 * month), notification.nid);

		await notifications.prune();

		const data = await notifications.get(notification.nid);
		assert(!data);
	});
});
