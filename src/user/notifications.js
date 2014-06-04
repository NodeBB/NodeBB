
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	db = require('../database'),
	notifications = require('../notifications'),
	posts = require('../posts'),
	topics = require('../topics');

(function(UserNotifications) {
	UserNotifications.get = function(uid, callback) {
		function getNotifications(set, start, stop, iterator, done) {
			db.getSortedSetRevRange(set, start, stop, function(err, nids) {
				if(err) {
					return done(err);
				}

				if(!nids || nids.length === 0) {
					return done(null, []);
				}

				if (nids.length > maxNotifs) {
					nids.length = maxNotifs;
				}

				async.map(nids, function(nid, next) {
					notifications.get(nid, uid, function(notif_data) {
						if(typeof iterator === 'function') {
							iterator(notif_data);
						}

						next(null, notif_data);
					});
				}, done);
			});
		}

		var maxNotifs = 15;

		async.parallel({
			unread: function(next) {
				getNotifications('uid:' + uid + ':notifications:unread', 0, 9, function(notif_data) {
					if (notif_data) {
						notif_data.readClass = !notif_data.read ? 'label-warning' : '';
					}
				}, next);
			},
			read: function(next) {
				getNotifications('uid:' + uid + ':notifications:read', 0, 9, null, next);
			}
		}, function(err, notifications) {
			function filterDeleted(notifObj) {
				return !!notifObj;
			}
			if(err) {
				return callback(err);
			}

			notifications.read = notifications.read.filter(filterDeleted);
			notifications.unread = notifications.unread.filter(filterDeleted);

			// Limit the number of notifications to `maxNotifs`, prioritising unread notifications
			if (notifications.read.length + notifications.unread.length > maxNotifs) {
				notifications.read.length = maxNotifs - notifications.unread.length;
			}

			callback(null, notifications);
		});
	};

	UserNotifications.getAll = function(uid, limit, before, callback) {
		var	now = new Date();

		if (!limit || parseInt(limit, 10) <= 0) {
			limit = 25;
		}
		if (before) {
			before = new Date(parseInt(before, 10));
		}

		db.getSortedSetRevRangeByScore('uid:' + uid + ':notifications:read', 0, limit, before ? before.getTime(): now.getTime(), -Infinity, function(err, results1) {
			db.getSortedSetRevRangeByScore('uid:' + uid + ':notifications:unread', 0, limit, before ? before.getTime(): now.getTime(), -Infinity, function(err, results2) {

				var nids = results1.concat(results2);
				async.map(nids, function(nid, next) {
					notifications.get(nid, uid, function(notif_data) {
						next(null, notif_data);
					});
				}, function(err, notifs) {
					notifs = notifs.filter(function(notif) {
						return notif !== null;
					}).sort(function(a, b) {
						return parseInt(b.datetime, 10) - parseInt(a.datetime, 10);
					}).map(function(notif) {
						notif.datetimeISO = utils.toISOString(notif.datetime);
						notif.readClass = !notif.read ? 'label-warning' : '';

						return notif;
					});

					callback(err, notifs);
				});
			});
		});
	};

	UserNotifications.getDailyUnread = function(uid, callback) {
		var	now = Date.now(),
			yesterday = now - (1000*60*60*24);	// Approximate, can be more or less depending on time changes, makes no difference really.
		db.getSortedSetRangeByScore('uid:' + uid + ':notifications:unread', 0, 20, yesterday, now, function(err, nids) {
			async.map(nids, function(nid, next) {
				notifications.get(nid, uid, function(notif_data) {
					next(null, notif_data);
				});
			}, callback);
		});
	};

	UserNotifications.getUnreadCount = function(uid, callback) {
		db.sortedSetCount('uid:' + uid + ':notifications:unread', -Infinity, Infinity, callback);
	};

	UserNotifications.getUnreadByUniqueId = function(uid, uniqueId, callback) {
		db.getSortedSetRange('uid:' + uid + ':notifications:unread', 0, -1, function(err, nids) {

			async.filter(nids, function(nid, next) {
				notifications.get(nid, uid, function(notifObj) {
					if(!notifObj) {
						return next(false);
					}

					if (notifObj.uniqueId === uniqueId) {
						next(true);
					} else {
						next(false);
					}
				});
			}, function(nids) {
				callback(null, nids);
			});
		});
	};

	UserNotifications.sendPostNotificationToFollowers = function(uid, tid, pid) {
		db.getSetMembers('followers:' + uid, function(err, followers) {
			if (err || !followers || !followers.length) {
				return;
			}

			async.parallel({
				username: function(next) {
					user.getUserField(uid, 'username', next);
				},
				slug: function(next) {
					topics.getTopicField(tid, 'slug', next);
				},
				postIndex: function(next) {
					posts.getPidIndex(pid, next);
				}
			}, function(err, results) {
				if (err) {
					return;
				}

				var message = '[[notifications:user_made_post, ' + results.username + ']]';
				var path = nconf.get('relative_path') + '/topic/' + results.slug;
				if (parseInt(results.postIndex, 10)) {
					path += '/' + (parseInt(results.postIndex, 10) + 1);
				}
				notifications.create({
					text: message,
					path: path,
					uniqueId: 'topic:' + tid,
					from: uid
				}, function(nid) {
					notifications.push(nid, followers);
				});
			});
		});
	};

	UserNotifications.pushCount = function(uid) {
		var websockets = require('./../socket.io');
		UserNotifications.getUnreadCount(uid, function(err, count) {
			if (err) {
				return winston.warn('[User.pushNotifCount] Count not retrieve unread notifications count to push to uid ' + uid + '\'s client(s)');
			}

			websockets.in('uid_' + uid).emit('event:notifications.updateCount', count);
		});
	};

}(exports));
