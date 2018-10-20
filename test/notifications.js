'use strict';


var assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var meta = require('../src/meta');
var user = require('../src/user');
var topics = require('../src/topics');
var categories = require('../src/categories');
var groups = require('../src/groups');
var notifications = require('../src/notifications');
var socketNotifications = require('../src/socket.io/notifications');

describe('Notifications', function () {
	var uid;
	var notification;

	before(function (done) {
		user.create({ username: 'poster' }, function (err, _uid) {
			if (err) {
				return done(err);
			}

			uid = _uid;
			done();
		});
	});

	it('should fail to create notification without a nid', function (done) {
		notifications.create({}, function (err) {
			assert.equal(err.message, '[[error:no-notification-id]]');
			done();
		});
	});

	it('should create a notification', function (done) {
		notifications.create({
			bodyShort: 'bodyShort',
			nid: 'notification_id',
			path: '/notification/path',
			pid: 1,
		}, function (err, _notification) {
			notification = _notification;
			assert.ifError(err);
			assert(notification);
			db.exists('notifications:' + notification.nid, function (err, exists) {
				assert.ifError(err);
				assert(exists);
				db.isSortedSetMember('notifications', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			});
		});
	});

	it('should return null if pid is same and importance is lower', function (done) {
		notifications.create({
			bodyShort: 'bodyShort',
			nid: 'notification_id',
			path: '/notification/path',
			pid: 1,
			importance: 1,
		}, function (err, notification) {
			assert.ifError(err);
			assert.strictEqual(notification, null);
			done();
		});
	});

	it('should get empty array', function (done) {
		notifications.getMultiple(null, function (err, data) {
			assert.ifError(err);
			assert(Array.isArray(data));
			assert.equal(data.length, 0);
			done();
		});
	});

	it('should get notifications', function (done) {
		notifications.getMultiple([notification.nid], function (err, notificationsData) {
			assert.ifError(err);
			assert(Array.isArray(notificationsData));
			assert(notificationsData[0]);
			assert.equal(notification.nid, notificationsData[0].nid);
			done();
		});
	});

	it('should do nothing', function (done) {
		notifications.push(null, [], function (err) {
			assert.ifError(err);
			notifications.push({ nid: null }, [], function (err) {
				assert.ifError(err);
				notifications.push(notification, [], function (err) {
					assert.ifError(err);
					done();
				});
			});
		});
	});

	it('should push a notification to uid', function (done) {
		notifications.push(notification, [uid], function (err) {
			assert.ifError(err);
			setTimeout(function () {
				db.isSortedSetMember('uid:' + uid + ':notifications:unread', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			}, 2000);
		});
	});

	it('should push a notification to a group', function (done) {
		notifications.pushGroup(notification, 'registered-users', function (err) {
			assert.ifError(err);
			setTimeout(function () {
				db.isSortedSetMember('uid:' + uid + ':notifications:unread', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			}, 2000);
		});
	});

	it('should push a notification to groups', function (done) {
		notifications.pushGroups(notification, ['registered-users', 'administrators'], function (err) {
			assert.ifError(err);
			setTimeout(function () {
				db.isSortedSetMember('uid:' + uid + ':notifications:unread', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert(isMember);
					done();
				});
			}, 2000);
		});
	});

	it('should not mark anything with invalid uid or nid', function (done) {
		socketNotifications.markRead({ uid: null }, null, function (err) {
			assert.ifError(err);
			socketNotifications.markRead({ uid: uid }, null, function (err) {
				assert.ifError(err);
				done();
			});
		});
	});

	it('should mark a notification read', function (done) {
		socketNotifications.markRead({ uid: uid }, notification.nid, function (err) {
			assert.ifError(err);
			db.isSortedSetMember('uid:' + uid + ':notifications:unread', notification.nid, function (err, isMember) {
				assert.ifError(err);
				assert.equal(isMember, false);
				db.isSortedSetMember('uid:' + uid + ':notifications:read', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert.equal(isMember, true);
					done();
				});
			});
		});
	});

	it('should not mark anything with invalid uid or nid', function (done) {
		socketNotifications.markUnread({ uid: null }, null, function (err) {
			assert.ifError(err);
			socketNotifications.markUnread({ uid: uid }, null, function (err) {
				assert.ifError(err);
				done();
			});
		});
	});

	it('should error if notification does not exist', function (done) {
		socketNotifications.markUnread({ uid: uid }, 123123, function (err) {
			assert.equal(err.message, '[[error:no-notification]]');
			done();
		});
	});

	it('should mark a notification unread', function (done) {
		socketNotifications.markUnread({ uid: uid }, notification.nid, function (err) {
			assert.ifError(err);
			db.isSortedSetMember('uid:' + uid + ':notifications:unread', notification.nid, function (err, isMember) {
				assert.ifError(err);
				assert.equal(isMember, true);
				db.isSortedSetMember('uid:' + uid + ':notifications:read', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert.equal(isMember, false);
					socketNotifications.getCount({ uid: uid }, null, function (err, count) {
						assert.ifError(err);
						assert.equal(count, 1);
						done();
					});
				});
			});
		});
	});

	it('should mark all notifications read', function (done) {
		socketNotifications.markAllRead({ uid: uid }, null, function (err) {
			assert.ifError(err);
			db.isSortedSetMember('uid:' + uid + ':notifications:unread', notification.nid, function (err, isMember) {
				assert.ifError(err);
				assert.equal(isMember, false);
				db.isSortedSetMember('uid:' + uid + ':notifications:read', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert.equal(isMember, true);
					done();
				});
			});
		});
	});

	it('should not do anything', function (done) {
		socketNotifications.markAllRead({ uid: 1000 }, null, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should link to the first unread post in a watched topic', function (done) {
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
				assert.equal('/post/' + pid, notifications.unread[0].path, 'the notification should link to the first unread post');
				next();
			},
		], function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should get notification by nid', function (done) {
		socketNotifications.get({ uid: uid }, { nids: [notification.nid] }, function (err, data) {
			assert.ifError(err);
			assert.equal(data[0].bodyShort, 'bodyShort');
			assert.equal(data[0].nid, 'notification_id');
			assert.equal(data[0].path, '/notification/path');
			done();
		});
	});

	it('should get user\'s notifications', function (done) {
		socketNotifications.get({ uid: uid }, {}, function (err, data) {
			assert.ifError(err);
			assert.equal(data.unread.length, 0);
			assert.equal(data.read[0].nid, 'notification_id');
			done();
		});
	});

	it('should error if not logged in', function (done) {
		socketNotifications.deleteAll({ uid: 0 }, null, function (err) {
			assert.equal(err.message, '[[error:no-privileges]]');
			done();
		});
	});

	it('should delete all user notifications', function (done) {
		socketNotifications.deleteAll({ uid: uid }, null, function (err) {
			assert.ifError(err);
			socketNotifications.get({ uid: uid }, {}, function (err, data) {
				assert.ifError(err);
				assert.equal(data.unread.length, 0);
				assert.equal(data.read.length, 0);
				done();
			});
		});
	});

	it('should return empty with falsy uid', function (done) {
		user.notifications.get(0, function (err, data) {
			assert.ifError(err);
			assert.equal(data.read.length, 0);
			assert.equal(data.unread.length, 0);
			done();
		});
	});

	it('should get all notifications and filter', function (done) {
		var nid = 'willbefiltered';
		notifications.create({
			bodyShort: 'bodyShort',
			nid: nid,
			path: '/notification/path',
			type: 'post',
		}, function (err, notification) {
			assert.ifError(err);
			notifications.push(notification, [uid], function (err) {
				assert.ifError(err);
				setTimeout(function () {
					user.notifications.getAll(uid, 'post', function (err, nids) {
						assert.ifError(err);
						assert(nids.includes(nid));
						done();
					});
				}, 1500);
			});
		});
	});

	it('should not get anything if notifications does not exist', function (done) {
		user.notifications.getNotifications(['doesnotexistnid1', 'doesnotexistnid2'], uid, function (err, data) {
			assert.ifError(err);
			assert.deepEqual(data, []);
			done();
		});
	});

	it('should get daily notifications', function (done) {
		user.notifications.getDailyUnread(uid, function (err, data) {
			assert.ifError(err);
			assert.equal(data[0].nid, 'willbefiltered');
			done();
		});
	});

	it('should return 0 for falsy uid', function (done) {
		user.notifications.getUnreadCount(0, function (err, count) {
			assert.ifError(err);
			assert.equal(count, 0);
			done();
		});
	});

	it('should not do anything if uid is falsy', function (done) {
		user.notifications.deleteAll(0, function (err) {
			assert.ifError(err);
			done();
		});
	});

	it('should send notification to followers of user when he posts', function (done) {
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
		], function (err, data) {
			assert.ifError(err);
			assert(data);
			done();
		});
	});

	it('should send welcome notification', function (done) {
		meta.config.welcomeNotification = 'welcome to the forums';
		user.notifications.sendWelcomeNotification(uid, function (err) {
			assert.ifError(err);
			user.notifications.sendWelcomeNotification(uid, function (err) {
				assert.ifError(err);
				setTimeout(function () {
					user.notifications.getAll(uid, '', function (err, data) {
						meta.config.welcomeNotification = '';
						assert.ifError(err);
						assert.notEqual(data.indexOf('welcome_' + uid), -1);
						done();
					});
				}, 1100);
			});
		});
	});

	it('should prune notifications', function (done) {
		notifications.create({
			bodyShort: 'bodyShort',
			nid: 'tobedeleted',
			path: '/notification/path',
		}, function (err, notification) {
			assert.ifError(err);
			notifications.prune(function (err) {
				assert.ifError(err);
				var week = 604800000;
				db.sortedSetAdd('notifications', Date.now() - (2 * week), notification.nid, function (err) {
					assert.ifError(err);
					notifications.prune(function (err) {
						assert.ifError(err);
						notifications.get(notification.nid, function (err, data) {
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
