
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	db = require('../database'),
	notifications = require('../notifications'),
	posts = require('../posts'),
	postTools = require('../postTools'),
	topics = require('../topics'),
	privileges = require('../privileges');

(function(UserNotifications) {

	UserNotifications.get = function(uid, callback) {
		function getNotifications(set, start, stop, iterator, done) {
			db.getSortedSetRevRange(set, start, stop, function(err, uniqueIds) {
				if(err) {
					return done(err);
				}

				if(!Array.isArray(uniqueIds) || !uniqueIds.length) {
					return done(null, []);
				}

				if (uniqueIds.length > maxNotifs) {
					uniqueIds.length = maxNotifs;
				}

				db.getObjectFields('uid:' + uid + ':notifications:uniqueId:nid', uniqueIds, function(err, uniqueIdToNids) {
					if (err) {
						return done(err);
					}

					var nidsToUniqueIds = {};
					var nids = [];
					uniqueIds.forEach(function(uniqueId) {
						nidsToUniqueIds[uniqueIdToNids[uniqueId]] = uniqueId;
						nids.push(uniqueIdToNids[uniqueId]);
					});

					async.map(nids, function(nid, next) {
						notifications.get(nid, function(err, notif_data) {
							if (err) {
								return next(err);
							}

							if (!notif_data) {
								if (process.env.NODE_ENV === 'development') {
									winston.info('[notifications.get] nid ' + nid + ' not found. Removing.');
								}

								db.sortedSetRemove(set, nidsToUniqueIds[nid]);
								db.deleteObjectField('uid:' + uid + ':notifications:uniqueId:nid', nidsToUniqueIds[nid]);
								return next();
							}

							if (typeof iterator === 'function') {
								iterator(notif_data, next);
							} else {
								next(null, notif_data);
							}
						});
					}, done);
				});
			});
		}

		var maxNotifs = 15;

		async.parallel({
			unread: function(next) {
				getNotifications('uid:' + uid + ':notifications:unread', 0, 9, function(notif_data, next) {
					notif_data.read = false;
					notif_data.readClass = !notif_data.read ? 'label-warning' : '';
					next(null, notif_data);
				}, next);
			},
			read: function(next) {
				getNotifications('uid:' + uid + ':notifications:read', 0, 9, function(notif_data, next) {
					notif_data.read = true;
					next(null, notif_data);
				}, next);
			}
		}, function(err, notifications) {
			function filterDeleted(notifObj) {
				return !!notifObj;
			}

			if (err) {
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

		db.getObjectValues('uid:' + uid + ':notifications:uniqueId:nid', function(err, nids) {
			if (err) {
				return callback(err);
			}

			async.map(nids, function(nid, next) {
				notifications.get(nid, function(err, notif_data) {
					if (err || !notif_data) {
						return next(err);
					}
					UserNotifications.isNotificationRead(notif_data.uniqueId, uid, function(err, isRead) {
						if (err) {
							return next(err);
						}

						notif_data.read = isRead;
						next(null, notif_data);
					});
				});
			}, function(err, notifs) {
				if (err) {
					return callback(err);
				}

				notifs = notifs.filter(function(notif) {
					return !!notif;
				}).sort(function(a, b) {
					return parseInt(b.datetime, 10) - parseInt(a.datetime, 10);
				}).map(function(notif) {
					notif.datetimeISO = utils.toISOString(notif.datetime);
					notif.readClass = !notif.read ? 'label-warning' : '';
					return notif;
				});

				callback(null, notifs);
			});
		});
	};

	UserNotifications.isNotificationRead = function(uniqueId, uid, callback) {
		db.isSortedSetMember('uid:' + uid + ':notifications:read', uniqueId, callback);
	};

	UserNotifications.getDailyUnread = function(uid, callback) {
		var	now = Date.now(),
			yesterday = now - (1000*60*60*24);	// Approximate, can be more or less depending on time changes, makes no difference really.

		db.getSortedSetRangeByScore('uid:' + uid + ':notifications:unread', 0, 20, yesterday, now, function(err, uniqueIds) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(uniqueIds) || !uniqueIds.length) {
				return callback(null, []);
			}

			db.getObjectFields('uid:' + uid + ':notifications:uniqueId:nid', uniqueIds, function(err, uniqueIdToNids) {
				if (err) {
					return callback(err);
				}

				var nids = Object.keys(uniqueIdToNids).map(function(uniqueId) {
					return uniqueIdToNids[uniqueId];
				});

				async.map(nids, function(nid, next) {
					notifications.get(nid, next);
				}, callback);
			});
		});
	};

	UserNotifications.getUnreadCount = function(uid, callback) {
		db.sortedSetCount('uid:' + uid + ':notifications:unread', -Infinity, Infinity, callback);
	};

	UserNotifications.getUnreadByField = function(uid, field, value, callback) {
		db.getSortedSetRange('uid:' + uid + ':notifications:unread', 0, -1, function(err, uniqueIds) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(uniqueIds) || !uniqueIds.length) {
				return callback(null, []);
			}

			db.getObjectFields('uid:' + uid + ':notifications:uniqueId:nid', uniqueIds, function(err, uniqueIdsToNids) {
				if (err) {
					return callback(err);
				}

				var nids = Object.keys(uniqueIdsToNids).map(function(uniqueId) {
					return uniqueIdsToNids[uniqueId];
				});

				async.filter(nids, function(nid, next) {
					notifications.get(nid, function(err, notifObj) {
						if (err || !notifObj) {
							return next(false);
						}

						next(notifObj[field] === value.toString());
					});
				}, function(nids) {
					callback(null, nids);
				});
			});
		});
	};


	UserNotifications.sendPostNotificationToFollowers = function(uid, tid, pid) {
		db.getSetMembers('followers:' + uid, function(err, followers) {
			if (err || !followers || !followers.length) {
				return;
			}

			async.parallel({
				username: async.apply(user.getUserField, uid, 'username'),
				topic: async.apply(topics.getTopicFields, tid, ['slug', 'cid', 'title']),
				postIndex: async.apply(posts.getPidIndex, pid),
				postContent: function(next) {
					async.waterfall([
						async.apply(posts.getPostField, pid, 'content'),
						function(content, next) {
							postTools.parse(content, next);
						}
					], next);
				},
				topicFollowers: function(next) {
					db.isSetMembers('tid:' + tid + ':followers', followers, next);
				}
			}, function(err, results) {
				if (err) {
					return;
				}

				followers = followers.filter(function(value, index) {
					return !results.topicFollowers[index];
				});

				notifications.create({
					bodyShort: '[[notifications:user_posted_to, ' + results.username + ', ' + results.topic.title + ']]',
					bodyLong: results.postContent,
					path: nconf.get('relative_path') + '/topic/' + results.topic.slug + '/' + results.postIndex,
					uniqueId: 'topic:' + tid + ':uid:' + uid,
					tid: tid,
					from: uid
				}, function(err, nid) {
					if (err) {
						return;
					}
					async.filter(followers, function(uid, next) {
						privileges.categories.can('read', results.topic.cid, uid, function(err, canRead) {
							next(!err && canRead);
						});
					}, function(followers){
						notifications.push(nid, followers);
					});
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
