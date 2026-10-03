'use strict';


const assert = require('assert');
const nconf = require('nconf');
const util = require('util');

const db = require('./mocks/databasemock');
const meta = require('../src/meta');
const user = require('../src/user');
const posts = require('../src/posts');
const topics = require('../src/topics');
const categories = require('../src/categories');
const notifications = require('../src/notifications');
const plugins = require('../src/plugins');
const socketNotifications = require('../src/socket.io/notifications');
const api = require('../src/api');
const utils = require('../src/utils');
const tx = require('../src/translator');

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

	it('should link to the first unread post when a merged notification exceeds the dropdown limit', async () => {
		const watcherUid = await user.create({ username: 'watcher-over-limit' });
		const { cid } = await categories.create({
			name: 'Notification limit test category',
			description: 'Test category created by testing script',
		});
		const { topicData } = await topics.post({
			uid: watcherUid,
			cid: cid,
			title: 'Notification limit test topic',
			content: 'The topic content.',
		});
		const { tid } = topicData;
		await topics.unfollow(tid, watcherUid);

		const replies = [];
		for (let index = 0; index < 52; index += 1) {
			// eslint-disable-next-line no-await-in-loop
			replies.push(await topics.reply({
				uid: uid,
				content: `Reply ${index + 1}.`,
				tid: tid,
			}));
		}

		const timestamp = Date.now();
		const unrelated = await notifications.create({
			type: 'new-reply',
			bodyShort: 'Unrelated notification',
			nid: 'notification-limit:unrelated',
			mergeId: 'notifications:user-posted-to|unrelated',
			path: '/post/unrelated',
			pid: 'unrelated',
			tid: 'unrelated',
			from: uid,
		});
		await db.sortedSetAdd(`uid:${watcherUid}:notifications:unread`, timestamp - 1, unrelated.nid);
		const createdNotifications = await Promise.all(replies.map(async ({ pid }, index) => {
			const notification = await notifications.create({
				type: 'new-reply',
				bodyShort: tx.compile('notifications:user-posted-to', 'poster', topicData.title),
				nid: `notification-limit:tid:${tid}:pid:${pid}`,
				mergeId: `notifications:user-posted-to|${tid}`,
				path: `/post/${pid}`,
				pid: pid,
				tid: tid,
				from: uid,
				topicTitle: topicData.title,
			});
			await db.sortedSetAdd(`uid:${watcherUid}:notifications:unread`, timestamp + index, notification.nid);
			return notification;
		}));

		const result = await user.notifications.get(watcherUid);
		assert.equal(result.unread.length, 1, 'there should be 1 merged unread notification');
		assert.equal(
			result.unread[0].path,
			`${nconf.get('relative_path')}/post/${replies[0].pid}`,
			'the merged notification should link to the first unread post even when it is outside the loaded batch'
		);
		assert.strictEqual(result.unread[0].pid, replies[0].pid, 'the first unread pid should remain a number');

		await Promise.all([
			db.sortedSetRemove(`uid:${watcherUid}:notifications:unread`, createdNotifications[0].nid),
			db.sortedSetAdd(`uid:${watcherUid}:notifications:read`, timestamp, createdNotifications[0].nid),
		]);
		const afterReadingOldest = await user.notifications.get(watcherUid);
		assert.equal(afterReadingOldest.unread.length, 1, 'there should still be 1 merged unread notification');
		assert.equal(
			afterReadingOldest.unread[0].path,
			`${nconf.get('relative_path')}/post/${replies[1].pid}`,
			'the merged notification should advance to the next oldest unread post'
		);
		assert.strictEqual(
			afterReadingOldest.unread[0].pid,
			replies[1].pid,
			'the next unread pid should remain a number'
		);

		await db.delete(`notifications:${createdNotifications[1].nid}`);
		const afterPruningOldest = await user.notifications.get(watcherUid);
		assert.equal(afterPruningOldest.unread[0].path, `${nconf.get('relative_path')}/post/${replies[2].pid}`);
		assert.strictEqual(afterPruningOldest.unread[0].pid, replies[2].pid);

		await posts.delete(replies[2].pid, uid);
		const afterDeletingOldestPost = await user.notifications.get(watcherUid);
		assert.equal(afterDeletingOldestPost.unread[0].path, `${nconf.get('relative_path')}/post/${replies[3].pid}`);
		assert.strictEqual(afterDeletingOldestPost.unread[0].pid, replies[3].pid);
	});

	it('should keep the unread dropdown limited to 50 notifications', async () => {
		const watcherUid = await user.create({ username: 'watcher-unmerged-limit' });
		const timestamp = Date.now();
		const nids = await Promise.all(Array.from({ length: 51 }, async (_, index) => {
			const notification = await notifications.create({
				nid: `notification-unmerged-limit:${index}`,
				bodyShort: `Notification ${index}`,
				path: '/notifications',
				from: uid,
			});
			await db.sortedSetAdd(`uid:${watcherUid}:notifications:unread`, timestamp + index, notification.nid);
			return notification.nid;
		}));

		const result = await user.notifications.get(watcherUid);
		assert.strictEqual(result.unread.length, 50);
		assert.strictEqual(result.read.length, 0);
		assert(!result.unread.some(n => n.nid === nids[0]), 'the lookahead ID should not be displayed');
		await db.sortedSetRemove(`uid:${watcherUid}:notifications:unread`, nids[0]);
		const exactlyFifty = await user.notifications.get(watcherUid);
		assert.strictEqual(exactlyFifty.unread.length, 50);
		assert.deepStrictEqual(exactlyFifty.unread.map(n => n.nid), result.unread.map(n => n.nid));
	});

	it('should get notification by nid', async () => {
		const [notifObj] = await socketNotifications.get({ uid: uid }, { nids: [notification.nid] });
		assert.equal(notifObj.bodyShort, 'bodyShort');
		assert.equal(notifObj.nid, 'notification_id');
		assert.equal(notifObj.path, `${nconf.get('relative_path')}/notification/path`);
	});

	it('should not return another user\'s notification by nid', async () => {
		const notifObj = await api.notifications.get({ uid: 0 }, { nid: notification.nid });
		assert.deepStrictEqual(notifObj, { notification: undefined });
	});

	it('should not mark unread/read if notification does not belong to user', async () => {
		const uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
		await api.notifications.markUnread({ uid: uid }, { nid: notification.nid });
		assert.strictEqual(
			await db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid),
			false
		);

		await api.notifications.markRead({ uid: uid }, { nid: notification.nid }),
		assert.strictEqual(
			await db.isSortedSetMember(`uid:${uid}:notifications:read`, notification.nid),
			false,
		);
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
			content: 'The content of test topic <script>alert(document.domain)</script>',
		});
		await sleep(1100);
		const data = await user.notifications.getAll(followerUid, '');
		assert(Array.isArray(data));
		const notifs = await user.notifications.get(followerUid);
		assert.strictEqual(notifs.unread[0].bodyLong, 'The content of test topic ');
	});

	it('should sanitize html in notification args', async () => {
		const bodyShort = tx.compile(
			'notifications:user-posted-topic-in-category',
			'displayName]]<img src=x onerror=alert(document.domain)>',
			'topicTitle]]<img src=x onerror=alert(document.domain)>',
			'Lounge]]<img src=x onerror=alert(document.domain)>' // categoy name
		);

		const uid = await user.create({ username: utils.generateUUID().slice(0, 8) });
		const notification = await notifications.create({
			type: 'new-topic-in-category',
			nid: 'new_topic:tid:1:uid:1',
			bodyShort: bodyShort,
			pid: 1,
			path: '/post/1',
			tid: 1,
			from: 1,
		});

		notifications.push(notification, [uid]);
		await sleep(2000);

		const notifData = await user.notifications.get(uid);
		assert.strictEqual(notifData.unread[0].bodyShort, '<strong>displayName]]&lt;img src=x onerror=alert(document.domain)&gt;</strong> posted <strong>topicTitle]]&lt;img src=x onerror=alert(document.domain)&gt;</strong> in <strong>Lounge]]&lt;img src=x onerror=alert(document.domain)&gt;</strong>');
	});

	it('should sanitize html in notification args', async () => {
		const uid = await user.create({ username: utils.generateUUID().slice(0, 8) });

		const notification = await notifications.create({
			type: 'new-topic-in-category',
			nid: 'new_topic:tid:1:uid:1',
			bodyShort: '<img src=x onerror=alert(document.domain)>',
			bodyLong: 'bodylong <script>alert(document.domain)</script>',
			pid: 1,
			path: '/post/1',
			tid: 1,
			from: 1,
		});

		notifications.push(notification, [uid]);
		await sleep(2000);

		const notifData = await user.notifications.get(uid);
		assert.strictEqual(notifData.unread[0].bodyShort, '<img src="x" />');
		assert.strictEqual(notifData.unread[0].bodyLong, 'bodylong ');
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

	describe('.merge()', () => {
		it('should expose how many notifications were merged', async () => {
			const merged = await notifications.merge([
				{ nid: 'n1', mergeId: 'new-register', bodyShort: 'one' },
				{ nid: 'n2', mergeId: 'new-register', bodyShort: 'two' },
				{ nid: 'n3', mergeId: 'new-register', bodyShort: 'three' },
			]);

			assert.strictEqual(merged.length, 1);
			assert.strictEqual(merged[0].mergeCount, 3);
		});

		it('should let a plugin register its own mergeId', async () => {
			const method = async (data) => {
				data.mergeIds.push('plugin-merge');
				return data;
			};
			plugins.hooks.register('notifications-merge-test', { hook: 'filter:notifications.mergeIds', method });

			let merged;
			try {
				merged = await notifications.merge([
					{ nid: 'p1', mergeId: 'plugin-merge|7', bodyShort: 'one' },
					{ nid: 'p2', mergeId: 'plugin-merge|7', bodyShort: 'two' },
					{ nid: 'p3', mergeId: 'unregistered-merge', bodyShort: 'three' },
				]);
			} finally {
				plugins.hooks.unregister('notifications-merge-test', 'filter:notifications.mergeIds', method);
			}

			assert.strictEqual(merged.length, 2);
			const survivor = merged.find(n => n.mergeId === 'plugin-merge|7');
			assert.strictEqual(survivor.bodyShort, '[[notifications:merged-notifications, 2]]');
			assert.strictEqual(survivor.mergeCount, 2);
		});

		it('should merge undifferentiated notifications alongside differentiated ones', async () => {
			const method = async (data) => {
				data.mergeIds.push('plugin-merge');
				return data;
			};
			plugins.hooks.register('notifications-merge-test', { hook: 'filter:notifications.mergeIds', method });

			let merged;
			try {
				merged = await notifications.merge([
					{ nid: 'b1', mergeId: 'plugin-merge', bodyShort: 'bare one' },
					{ nid: 'b2', mergeId: 'plugin-merge', bodyShort: 'bare two' },
					{ nid: 'd1', mergeId: 'plugin-merge|7', bodyShort: 'seven one' },
					{ nid: 'd2', mergeId: 'plugin-merge|7', bodyShort: 'seven two' },
				]);
			} finally {
				plugins.hooks.unregister('notifications-merge-test', 'filter:notifications.mergeIds', method);
			}

			assert.strictEqual(merged.length, 2);
			const bare = merged.find(n => n.mergeId === 'plugin-merge');
			assert.strictEqual(bare.bodyShort, '[[notifications:merged-notifications, 2]]');
			assert.strictEqual(bare.mergeCount, 2);
			const differentiated = merged.find(n => n.mergeId === 'plugin-merge|7');
			assert.strictEqual(differentiated.mergeCount, 2);
		});

		it('should give a plugin-registered mergeId a generic bodyShort with the merged count', async () => {
			const method = async (data) => {
				data.mergeIds.push('plugin-merge');
				return data;
			};
			plugins.hooks.register('notifications-merge-test', { hook: 'filter:notifications.mergeIds', method });

			let merged;
			try {
				merged = await notifications.merge([
					{ nid: 'g1', mergeId: 'plugin-merge|3', bodyShort: 'first' },
					{ nid: 'g2', mergeId: 'plugin-merge|3', bodyShort: 'second' },
					{ nid: 'g3', mergeId: 'plugin-merge|3', bodyShort: 'third' },
				]);
			} finally {
				plugins.hooks.unregister('notifications-merge-test', 'filter:notifications.mergeIds', method);
			}

			assert.strictEqual(merged.length, 1);
			assert.strictEqual(merged[0].mergeCount, 3);
			assert.strictEqual(merged[0].bodyShort, '[[notifications:merged-notifications, 3]]');
		});

		it('should let filter:notifications.merge override the generic bodyShort', async () => {
			const mergeIdsMethod = async (data) => {
				data.mergeIds.push('plugin-merge');
				return data;
			};
			const mergeMethod = async (data) => {
				data.notifications.forEach((n) => {
					if (n.mergeId === 'plugin-merge') {
						n.bodyShort = `custom ${n.mergeCount}`;
					}
				});
				return data;
			};
			plugins.hooks.register('notifications-merge-test', { hook: 'filter:notifications.mergeIds', method: mergeIdsMethod });
			plugins.hooks.register('notifications-merge-test', { hook: 'filter:notifications.merge', method: mergeMethod });

			let merged;
			try {
				merged = await notifications.merge([
					{ nid: 'o1', mergeId: 'plugin-merge', bodyShort: 'first' },
					{ nid: 'o2', mergeId: 'plugin-merge', bodyShort: 'second' },
				]);
			} finally {
				plugins.hooks.unregister('notifications-merge-test', 'filter:notifications.mergeIds', mergeIdsMethod);
				plugins.hooks.unregister('notifications-merge-test', 'filter:notifications.merge', mergeMethod);
			}

			assert.strictEqual(merged.length, 1);
			assert.strictEqual(merged[0].bodyShort, 'custom 2');
		});
	});
});
