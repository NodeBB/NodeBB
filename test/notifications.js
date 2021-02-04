'use strict';


var assert = require('assert');
var async = require('async');
var nconf = require('nconf');

var db = require('./mocks/databasemock');
var meta = require('../src/meta');
var user = require('../src/user');
var topics = require('../src/topics');
var categories = require('../src/categories');
var groups = require('../src/groups');
var notifications = require('../src/notifications');
var socketNotifications = require('../src/socket.io/notifications');

describe('Notifications', () => {
	var uid;
	var notification;

	before((done) => {
		user.create({ username: 'poster' }, (err, _uid) => {
			if (err) {
				return done(err);
			}

			uid = _uid;
			done();
		});
	});

	it('should fail to create notification without a nid', (done) => {
		notifications.create({}, (err) => {
			assert.equal(err.message, '[[error:no-notification-id]]');
			done();
		});
	});

	it('should create a notification', (done) => {
		notifications.create({
			bodyShort: 'bodyShort',
			nid: 'notification_id',
			path: '/notification/path',
			pid: 1,
		}, (err, _notification) => {
			notification = _notification;
			assert.ifError(err);
			assert(notification);
			db.exists(`notifications:${notification.nid}`, (err, exists) => {
				assert.ifError(err);
				assert(exists);
				db.isSortedSetMember('notifications', notification.nid, (err, isMember) => {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});
	});

	it('should return null if pid is same and importance is lower', (done) => {
		notifications.create({
			bodyShort: 'bodyShort',
			nid: 'notification_id',
			path: '/notification/path',
			pid: 1,
			importance: 1,
		}, (err, notification) => {
			assert.ifError(err);
			assert.strictEqual(notification, null);
			done();
		});
	});

	it('should get empty array', (done) => {
		notifications.getMultiple(null, (err, data) => {
			assert.ifError(err);
			assert(Array.isArray(data));
			assert.equal(data.length, 0);
			done();
		});
	});

	it('should get notifications', (done) => {
		notifications.getMultiple([notification.nid], (err, notificationsData) => {
			assert.ifError(err);
			assert(Array.isArray(notificationsData));
			assert(notificationsData[0]);
			assert.equal(notification.nid, notificationsData[0].nid);
			done();
		});
	});

	it('should do nothing', (done) => {
		notifications.push(null, [], (err) => {
			assert.ifError(err);
			notifications.push({ nid: null }, [], (err) => {
				assert.ifError(err);
				notifications.push(notification, [], (err) => {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	it('should push a notification to uid', (done) => {
		notifications.push(notification, [uid], (err) => {
			assert.ifError(err);
			setTimeout(() => {
				db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid, (err, isMember) => {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			}, 2000);
		});
	});

	it('should push a notification to a group', (done) => {
		notifications.pushGroup(notification, 'registered-users', (err) => {
			assert.ifError(err);
			setTimeout(() => {
				db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid, (err, isMember) => {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			}, 2000);
		});
	});

	it('should push a notification to groups', (done) => {
		notifications.pushGroups(notification, ['registered-users', 'administrators'], (err) => {
			assert.ifError(err);
			setTimeout(() => {
				db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid, (err, isMember) => {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			}, 2000);
		});
	});

	it('should not mark anything with invalid uid or nid', (done) => {
		socketNotifications.markRead({ uid: null }, null, (err) => {
			assert.ifError(err);
			socketNotifications.markRead({ uid: uid }, null, (err) => {
				assert.ifError(err);
				done();
			});
		});
	});

	it('should mark a notification read', (done) => {
		socketNotifications.markRead({ uid: uid }, notification.nid, (err) => {
			assert.ifError(err);
			db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid, (err, isMember) => {
				assert.ifError(err);
				assert.equal(isMember, false);
				db.isSortedSetMember(`uid:${uid}:notifications:read`, notification.nid, (err, isMember) => {
					assert.ifError(err);
					assert.equal(isMember, true);
					done();
				});
			});
		});
	});

	it('should not mark anything with invalid uid or nid', (done) => {
		socketNotifications.markUnread({ uid: null }, null, (err) => {
			assert.ifError(err);
			socketNotifications.markUnread({ uid: uid }, null, (err) => {
				assert.ifError(err);
				done();
			});
		});
	});

	it('should error if notification does not exist', (done) => {
		socketNotifications.markUnread({ uid: uid }, 123123, (err) => {
			assert.equal(err.message, '[[error:no-notification]]');
			done();
		});
	});

	it('should mark a notification unread', (done) => {
		socketNotifications.markUnread({ uid: uid }, notification.nid, (err) => {
			assert.ifError(err);
			db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid, (err, isMember) => {
				assert.ifError(err);
				assert.equal(isMember, true);
				db.isSortedSetMember(`uid:${uid}:notifications:read`, notification.nid, (err, isMember) => {
					assert.ifError(err);
					assert.equal(isMember, false);
					socketNotifications.getCount({ uid: uid }, null, (err, count) => {
						assert.ifError(err);
						assert.equal(count, 1);
						done();
					});
				});
			});
		});
	});

	it('should mark all notifications read', (done) => {
		socketNotifications.markAllRead({ uid: uid }, null, (err) => {
			assert.ifError(err);
			db.isSortedSetMember(`uid:${uid}:notifications:unread`, notification.nid, (err, isMember) => {
				assert.ifError(err);
				assert.equal(isMember, false);
				db.isSortedSetMember(`uid:${uid}:notifications:read`, notification.nid, (err, isMember) => {
					assert.ifError(err);
					assert.equal(isMember, true);
					done();
				});
			});
		});
	});

	it('should not do anything', (done) => {
		socketNotifications.markAllRead({ uid: 1000 }, null, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should link to the first unread post in a watched topic', (done) => {
		var categories = require('../src/categories');
		var topics = require('../src/topics');
		var watcherUid;
		var cid;
		var tid;
		var pid;

		async.waterfall([
			function (next) {
				user.create({ username: 'watcher' }, next);
			},
			function (_watcherUid, next) {
				watcherUid = _watcherUid;

				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			function (category, next) {
				cid = category.cid;

				topics.post({
					uid: watcherUid,
					cid: cid,
					title: 'Test Topic Title',
					content: 'The content of test topic',
				}, next);
			},
			function (topic, next) {
				tid = topic.topicData.tid;

				topics.follow(tid, watcherUid, next);
			},
			function (next) {
				topics.reply({
					uid: uid,
					content: 'This is the first reply.',
					tid: tid,
				}, next);
			},
			function (post, next) {
				pid = post.pid;

				topics.reply({
					uid: uid,
					content: 'This is the second reply.',
					tid: tid,
				}, next);
			},
			function (post, next) {
				// notifications are sent asynchronously with a 1 second delay.
				setTimeout(next, 3000);
			},
			function (next) {
				user.notifications.get(watcherUid, next);
			},
			function (notifications, next) {
				assert.equal(notifications.unread.length, 1, 'there should be 1 unread notification');
				assert.equal(`${nconf.get('relative_path')}/post/${pid}`, notifications.unread[0].path, 'the notification should link to the first unread post');
				next();
			},
		], (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should get notification by nid', (done) => {
		socketNotifications.get({ uid: uid }, { nids: [notification.nid] }, (err, data) => {
			assert.ifError(err);
			assert.equal(data[0].bodyShort, 'bodyShort');
			assert.equal(data[0].nid, 'notification_id');
			assert.equal(data[0].path, `${nconf.get('relative_path')}/notification/path`);
			done();
		});
	});

	it('should get user\'s notifications', (done) => {
		socketNotifications.get({ uid: uid }, {}, (err, data) => {
			assert.ifError(err);
			assert.equal(data.unread.length, 0);
			assert.equal(data.read[0].nid, 'notification_id');
			done();
		});
	});

	it('should error if not logged in', (done) => {
		socketNotifications.deleteAll({ uid: 0 }, null, (err) => {
			assert.equal(err.message, '[[error:no-privileges]]');
			done();
		});
	});

	it('should delete all user notifications', (done) => {
		socketNotifications.deleteAll({ uid: uid }, null, (err) => {
			assert.ifError(err);
			socketNotifications.get({ uid: uid }, {}, (err, data) => {
				assert.ifError(err);
				assert.equal(data.unread.length, 0);
				assert.equal(data.read.length, 0);
				done();
			});
		});
	});

	it('should return empty with falsy uid', (done) => {
		user.notifications.get(0, (err, data) => {
			assert.ifError(err);
			assert.equal(data.read.length, 0);
			assert.equal(data.unread.length, 0);
			done();
		});
	});

	it('should get all notifications and filter', (done) => {
		var nid = 'willbefiltered';
		notifications.create({
			bodyShort: 'bodyShort',
			nid: nid,
			path: '/notification/path',
			type: 'post',
		}, (err, notification) => {
			assert.ifError(err);
			notifications.push(notification, [uid], (err) => {
				assert.ifError(err);
				setTimeout(() => {
					user.notifications.getAll(uid, 'post', (err, nids) => {
						assert.ifError(err);
						assert(nids.includes(nid));
						done();
					});
				}, 1500);
			});
		});
	});

	it('should not get anything if notifications does not exist', (done) => {
		user.notifications.getNotifications(['doesnotexistnid1', 'doesnotexistnid2'], uid, (err, data) => {
			assert.ifError(err);
			assert.deepEqual(data, []);
			done();
		});
	});

	it('should get daily notifications', (done) => {
		user.notifications.getDailyUnread(uid, (err, data) => {
			assert.ifError(err);
			assert.equal(data[0].nid, 'willbefiltered');
			done();
		});
	});

	it('should return empty array for invalid interval', (done) => {
		user.notifications.getUnreadInterval(uid, '2 aeons', (err, data) => {
			assert.ifError(err);
			assert.deepEqual(data, []);
			done();
		});
	});

	it('should return 0 for falsy uid', (done) => {
		user.notifications.getUnreadCount(0, (err, count) => {
			assert.ifError(err);
			assert.equal(count, 0);
			done();
		});
	});

	it('should not do anything if uid is falsy', (done) => {
		user.notifications.deleteAll(0, (err) => {
			assert.ifError(err);
			done();
		});
	});

	it('should send notification to followers of user when he posts', (done) => {
		var followerUid;
		async.waterfall([
			function (next) {
				user.create({ username: 'follower' }, next);
			},
			function (_followerUid, next) {
				followerUid = _followerUid;
				user.follow(followerUid, uid, next);
			},
			function (next) {
				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script',
				}, next);
			},
			function (category, next) {
				topics.post({
					uid: uid,
					cid: category.cid,
					title: 'Test Topic Title',
					content: 'The content of test topic',
				}, next);
			},
			function (data, next) {
				setTimeout(next, 1100);
			},
			function (next) {
				user.notifications.getAll(followerUid, '', next);
			},
		], (err, data) => {
			assert.ifError(err);
			assert(data);
			done();
		});
	});

	it('should send welcome notification', (done) => {
		meta.config.welcomeNotification = 'welcome to the forums';
		user.notifications.sendWelcomeNotification(uid, (err) => {
			assert.ifError(err);
			user.notifications.sendWelcomeNotification(uid, (err) => {
				assert.ifError(err);
				setTimeout(() => {
					user.notifications.getAll(uid, '', (err, data) => {
						meta.config.welcomeNotification = '';
						assert.ifError(err);
						assert(data.includes(`welcome_${uid}`), data);
						done();
					});
				}, 2000);
			});
		});
	});

	it('should prune notifications', (done) => {
		notifications.create({
			bodyShort: 'bodyShort',
			nid: 'tobedeleted',
			path: '/notification/path',
		}, (err, notification) => {
			assert.ifError(err);
			notifications.prune((err) => {
				assert.ifError(err);
				var week = 604800000;
				db.sortedSetAdd('notifications', Date.now() - (2 * week), notification.nid, (err) => {
					assert.ifError(err);
					notifications.prune((err) => {
						assert.ifError(err);
						notifications.get(notification.nid, (err, data) => {
							assert.ifError(err);
							assert(!data);
							done();
						});
					});
				});
			});
		});
	});
});
