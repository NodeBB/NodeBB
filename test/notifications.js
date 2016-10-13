'use strict';
/*global require, after, before*/


var assert = require('assert');

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

	after(function (done) {
		db.flushdb(done);
	});
});
