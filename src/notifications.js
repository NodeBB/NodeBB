'use strict';

var async = require('async'),
	winston = require('winston'),
	cron = require('cron').CronJob,
	nconf = require('nconf'),
	S = require('string'),

	db = require('./database'),
	User = require('./user'),
	groups = require('./groups'),
	meta = require('./meta'),
	plugins = require('./plugins');

(function(Notifications) {

	Notifications.init = function() {
		winston.verbose('[notifications.init] Registering jobs.');
		new cron('*/30 * * * *', Notifications.prune, null, true);
	};

	Notifications.get = function(nid, callback) {
		Notifications.getMultiple([nid], function(err, notifications) {
			callback(err, Array.isArray(notifications) && notifications.length ? notifications[0] : null);
		});
	};

	Notifications.getMultiple = function(nids, callback) {
		var keys = nids.map(function(nid) {
			return 'notifications:' + nid;
		});

		db.getObjects(keys, function(err, notifications) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(notifications) || !notifications.length) {
				return callback(null, []);
			}

			async.map(notifications, function(notification, next) {
				if (!notification) {
					return next(null, null);
				}

				if (notification.bodyShort) {
					notification.bodyShort = S(notification.bodyShort).escapeHTML().s;
				}
				if (notification.bodyLong) {
					notification.bodyLong = S(notification.bodyLong).escapeHTML().s;
				}

				if (notification.from && !notification.image) {
					User.getUserFields(notification.from, ['username', 'userslug', 'picture'], function(err, userData) {
						if (err) {
							return next(err);
						}
						notification.image = userData.picture || null;
						notification.user = userData;
						next(null, notification);
					});
					return;
				} else if (notification.image) {
					switch(notification.image) {
						case 'brand:logo':
							notification.image = meta.config['brand:logo'] || nconf.get('relative_path') + '/logo.png';
						break;
					}

					return next(null, notification);
				} else {
					notification.image = meta.config['brand:logo'] || nconf.get('relative_path') + '/logo.png';
					return next(null, notification);
				}

			}, callback);
		});
	};

	Notifications.create = function(data, callback) {
		if (!data.nid) {
			return callback(new Error('no-notification-id'));
		}
		data.importance = data.importance || 5;
		db.getObject('notifications:' + data.nid, function(err, oldNotification) {
			if (err) {
				return callback(err);
			}

			if (oldNotification) {
				if (parseInt(oldNotification.pid, 10) === parseInt(data.pid, 10) && parseInt(oldNotification.importance, 10) > parseInt(data.importance, 10)) {
					return callback();
				}
			}

			var now = Date.now();
			data.datetime = now;
			async.parallel([
				function(next) {
					db.sortedSetAdd('notifications', now, data.nid, next);
				},
				function(next) {
					db.setObject('notifications:' + data.nid, data, next);
				}
			], function(err) {
				callback(err, data);
			});
		});
	};

	Notifications.push = function(notification, uids, callback) {
		callback = callback || function() {};

		if (!notification.nid) {
			return callback();
		}

		if (!Array.isArray(uids)) {
			uids = [uids];
		}

		uids = uids.filter(function(uid) {
			return parseInt(uid, 10);
		});

		if (!uids.length) {
			return callback();
		}

		var done = false;
		var start = 0;
		var batchSize = 50;

		setTimeout(function() {
			async.whilst(
				function() {
					return !done;
				},
				function(next) {
					var currentUids = uids.slice(start, start + batchSize);
					if (!currentUids.length) {
						done = true;
						return next();
					}
					pushToUids(currentUids, notification, function(err) {
						if (err) {
							return next(err);
						}
						start = start + batchSize;

						setTimeout(next, 1000);
					});
				},
				function(err) {
					if (err) {
						winston.error(err.stack);
					}
				}
			);
		}, 1000);

		callback();
	};

	function pushToUids(uids, notification, callback) {
		var unreadKeys = [];
		var readKeys = [];

		uids.forEach(function(uid) {
			unreadKeys.push('uid:' + uid + ':notifications:unread');
			readKeys.push('uid:' + uid + ':notifications:read');
		});

		var oneWeekAgo = Date.now() - 604800000;
		async.series([
			function(next) {
				db.sortedSetsAdd(unreadKeys, notification.datetime, notification.nid, next);
			},
			function(next) {
				db.sortedSetsRemove(readKeys, notification.nid, next);
			},
			function(next) {
				db.sortedSetsRemoveRangeByScore(unreadKeys, 0, oneWeekAgo, next);
			},
			function(next) {
				db.sortedSetsRemoveRangeByScore(readKeys, 0, oneWeekAgo, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('action:notification.pushed', {notification: notification, uids: uids});

			var websockets = require('./socket.io');
			if (websockets.server) {
				for(var i=0; i<uids.length; ++i) {
					websockets.in('uid_' + uids[i]).emit('event:new_notification', notification);
				}
			}

			callback();
		});
	}

	Notifications.pushGroup = function(notification, groupName, callback) {
		callback = callback || function() {};
		groups.getMembers(groupName, 0, -1, function(err, members) {
			if (err || !Array.isArray(members) || !members.length) {
				return callback(err);
			}

			Notifications.push(notification, members, callback);
		});
	};

	Notifications.markRead = function(nid, uid, callback) {
		callback = callback || function() {};
		if (!parseInt(uid, 10) || !nid) {
			return callback();
		}
		Notifications.markReadMultiple([nid], uid, callback);
	};

	Notifications.markUnread = function(nid, uid, callback) {
		callback = callback || function() {};
		if (!parseInt(uid, 10) || !nid) {
			return callback();
		}

		db.getObject('notifications:' + nid, function(err, notification) {
			if (err || !notification) {
				return callback(err || new Error('[[error:no-notification]]'));
			}
			notification.datetime = notification.datetime || Date.now();

			async.parallel([
				async.apply(db.sortedSetRemove, 'uid:' + uid + ':notifications:read', nid),
				async.apply(db.sortedSetAdd, 'uid:' + uid + ':notifications:unread', notification.datetime, nid)
			], callback);
		});
	};

	Notifications.markReadMultiple = function(nids, uid, callback) {
		callback = callback || function() {};
		nids = nids.filter(Boolean);
		if (!Array.isArray(nids) || !nids.length) {
			return callback();
		}

		var notificationKeys = nids.map(function(nid) {
			return 'notifications:' + nid;
		});

		db.getObjectsFields(notificationKeys, ['nid', 'datetime'], function(err, notificationData) {
			if (err) {
				return callback(err);
			}

			notificationData = notificationData.filter(function(notification) {
				return notification && notification.nid;
			});

			nids = notificationData.map(function(notification) {
				return notification.nid;
			});

			var datetimes = notificationData.map(function(notification) {
				return (notification && notification.datetime) || Date.now();
			});

			async.parallel([
				function(next) {
					db.sortedSetRemove('uid:' + uid + ':notifications:unread', nids, next);
				},
				function(next) {
					db.sortedSetAdd('uid:' + uid + ':notifications:read', datetimes, nids, next);
				}
			], callback);
		});
	};

	Notifications.markAllRead = function(uid, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 99, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(nids) || !nids.length) {
				return callback();
			}

			Notifications.markReadMultiple(nids, uid, callback);
		});
	};

	Notifications.prune = function() {
		var	week = 604800000,
			numPruned = 0;

		var	cutoffTime = Date.now() - week;

		db.getSortedSetRangeByScore('notifications', 0, 500, 0, cutoffTime, function(err, nids) {
			if (err) {
				return winston.error(err.message);
			}

			if (!Array.isArray(nids) || !nids.length) {
				return;
			}

			var	keys = nids.map(function(nid) {
				return 'notifications:' + nid;
			});

			numPruned = nids.length;

			async.parallel([
				function(next) {
					db.sortedSetRemove('notifications', nids, next);
				},
				function(next) {
					db.deleteAll(keys, next);
				}
			], function(err) {
				if (err) {
					return winston.error('Encountered error pruning notifications: ' + err.message);
				}
			});
		});
	};

	Notifications.merge = function(notifications, callback) {
		// When passed a set of notification objects, merge any that can be merged
		var mergeIds = [
				'notifications:favourited_your_post_in',
				'notifications:upvoted_your_post_in',
				'notifications:user_started_following_you',
				'notifications:user_posted_to',
				'notifications:user_flagged_post_in'
			],
			isolated, differentiators, differentiator, modifyIndex, set;

		notifications = mergeIds.reduce(function(notifications, mergeId) {
			isolated = notifications.filter(function(notifObj) {
				if (!notifObj || !notifObj.hasOwnProperty('mergeId')) {
					return false;
				}

				return notifObj.mergeId.split('|')[0] === mergeId;
			});

			if (isolated.length <= 1) {
				return notifications;	// Nothing to merge
			}

			// Each isolated mergeId may have multiple differentiators, so process each separately
			differentiators = isolated.reduce(function(cur, next) {
				differentiator = next.mergeId.split('|')[1];
				if (cur.indexOf(differentiator) === -1) {
					cur.push(differentiator);
				}

				return cur;
			}, []);
			
			differentiators.forEach(function(differentiator) {
				set = isolated.filter(function(notifObj) {
					return notifObj.mergeId === (mergeId + '|' + differentiator);
				});
				modifyIndex = notifications.indexOf(set[0]);
				if (modifyIndex === -1 || set.length === 1) {
					return notifications;
				}

				switch(mergeId) {
					case 'notifications:favourited_your_post_in':	// intentional fall-through
					case 'notifications:upvoted_your_post_in':
					case 'notifications:user_started_following_you':
					case 'notifications:user_posted_to':
					case 'notifications:user_flagged_post_in':
						var usernames = set.map(function(notifObj) {
							return notifObj.user.username;
						});
						var numUsers = usernames.length;

						// Update bodyShort
						if (numUsers === 2) {
							notifications[modifyIndex].bodyShort = '[[' + mergeId + '_dual, ' + usernames.join(', ') + ', ' + notifications[modifyIndex].topicTitle + ']]'
						} else {
							notifications[modifyIndex].bodyShort = '[[' + mergeId + '_multiple, ' + usernames[0] + ', ' + (numUsers-1) + ', ' + notifications[modifyIndex].topicTitle + ']]'
						}
						break;
				}

				// Filter out duplicates
				notifications = notifications.filter(function(notifObj, idx) {
					if (!notifObj || !notifObj.mergeId) {
						return true;
					}

					return !(notifObj.mergeId === (mergeId + '|' + differentiator) && idx !== modifyIndex);
				});
			});

			return notifications;
		}, notifications);

		plugins.fireHook('filter:notifications.merge', {
			notifications: notifications
		}, function(err, data) {
			callback(err, data.notifications);
		});
	};

}(exports));

