'use strict';
/*global require, after, before*/


var assert = require('assert');
var async = require('async');

var db = require('./mocks/databasemock');
var user = require('../src/user');
var notifications = require('../src/notifications');

describe('Notifications', function () {
	var uid;
	var notification;

	before(function (done) {
		user.create({username: 'poster'}, function (err, _uid) {
			if (err) {
				return done(err);
			}

			uid = _uid;
			done();
		});
	});

	it('should create a notification', function (done) {
		notifications.create({
			bodyShort: 'bodyShort',
			nid: 'notification_id'
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

	it('should get notifications', function (done) {
		notifications.getMultiple([notification.nid], function (err, notificationsData) {
			assert.ifError(err);
			assert(Array.isArray(notificationsData));
			assert(notificationsData[0]);
			assert.equal(notification.nid, notificationsData[0].nid);
			done();
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

	it('should mark a notification read', function (done) {
		notifications.markRead(notification.nid, uid, function (err) {
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

	it('should mark a notification unread', function (done) {
		notifications.markUnread(notification.nid, uid, function (err) {
			assert.ifError(err);
			db.isSortedSetMember('uid:' + uid + ':notifications:unread', notification.nid, function (err, isMember) {
				assert.ifError(err);
				assert.equal(isMember, true);
				db.isSortedSetMember('uid:' + uid + ':notifications:read', notification.nid, function (err, isMember) {
					assert.ifError(err);
					assert.equal(isMember, false);
					done();
				});
			});
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
				user.create({username: 'watcher'}, next);
			},
			function (_watcherUid, next) {
				watcherUid = _watcherUid;

				categories.create({
					name: 'Test Category',
					description: 'Test category created by testing script'
				}, next);
			},
			function (category, next) {
				cid = category.cid;

				topics.post({
					uid: watcherUid,
					cid: cid,
					title: 'Test Topic Title',
					content: 'The content of test topic'
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
					tid: tid
				}, next);
			},
			function (post, next) {
				pid = post.pid;

				topics.reply({
					uid: uid,
					content: 'This is the second reply.',
					tid: tid
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
			}
		], function (err) {
			assert.ifError(err);
			done();
		});
	});

	after(function (done) {
		db.emptydb(done);
	});
});
