'use strict';

var async = require('async'),
	winston = require('winston'),
	cron = require('cron').CronJob,
	nconf = require('nconf'),
	S = require('string'),
	_ = require('underscore'),

	db = require('./database'),
	utils = require('../public/src/utils'),
	events = require('./events'),
	User = require('./user'),
	groups = require('./groups'),
	meta = require('./meta'),
	plugins = require('./plugins');

(function(Notifications) {

	Notifications.init = function() {
		if (process.env.NODE_ENV === 'development') {
			winston.info('[notifications.init] Registering jobs.');
		}
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

				// Backwards compatibility for old notification schema
				// Remove this block when NodeBB v0.6.0 is released.
				if (notification.hasOwnProperty('text')) {
					notification.bodyShort = notification.text;
					notification.bodyLong = '';
					notification.text = S(notification.text).escapeHTML().s;
				}

				if (notification.bodyShort) {
					notification.bodyShort = S(notification.bodyShort).escapeHTML().s;
				}
				if (notification.bodyLong) {
					notification.bodyLong = S(notification.bodyLong).escapeHTML().s;
				}

				if (notification.from && !notification.image) {
					User.getUserField(notification.from, 'picture', function(err, picture) {
						if (err) {
							return next(err);
						}
						notification.image = picture;
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

		var websockets = require('./socket.io');
		if (!Array.isArray(uids)) {
			uids = [uids];
		}

		var unreadKeys = [];
		var readKeys = [];

		uids.filter(function(uid) {
			return parseInt(uid, 10);
		}).forEach(function(uid) {
			unreadKeys.push('uid:' + uid + ':notifications:unread');
			readKeys.push('uid:' + uid + ':notifications:read');
		});

		async.parallel([
			function(next) {
				db.sortedSetsAdd(unreadKeys, notification.datetime, notification.nid, next);
			},
			function(next) {
				db.sortedSetsRemove(readKeys, notification.nid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			var oneWeekAgo = Date.now() - 604800000;
			db.sortedSetsRemoveRangeByScore(unreadKeys, 0, oneWeekAgo);
			db.sortedSetsRemoveRangeByScore(readKeys, 0, oneWeekAgo);

			plugins.fireHook('action:notification.pushed', {notification: notification, uids: uids});
			callback();

			for(var i=0; i<uids.length; ++i) {
				websockets.in('uid_' + uids[i]).emit('event:new_notification', notification);
			}
		});
	};

	Notifications.pushGroup = function(notification, groupName, callback) {
		callback = callback || function() {};
		groups.get(groupName, {}, function(err, groupObj) {
			if (err || !groupObj || !Array.isArray(groupObj.members) || !groupObj.members.length) {
				return callback(err);
			}

			Notifications.push(notification, groupObj.members, callback);
		});
	};

	Notifications.markRead = function(nid, uid, callback) {
		callback = callback || function() {};
		if (!parseInt(uid, 10) || !parseInt(nid, 10)) {
			return callback();
		}
		Notifications.markReadMultiple([nid], uid, callback);
	};

	Notifications.markReadMultiple = function(nids, uid, callback) {
		callback = callback || function() {};
		if (!Array.isArray(nids) || !nids.length) {
			return callback();
		}

		var notificationKeys = nids.filter(Boolean).map(function(nid) {
			return 'notifications:' + nid;
		});

		db.getObjectsFields(notificationKeys, ['datetime'], function(err, notificationData) {
			if (err) {
				return callback(err);
			}

			var datetimes = notificationData.map(function(notification) {
				return notification && notification.datetime;
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
		db.getSortedSetRange('uid:' + uid + ':notifications:unread', 0, 99, function(err, nids) {
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
		var start = process.hrtime();

		if (process.env.NODE_ENV === 'development') {
			winston.info('[notifications.prune] Removing expired notifications from the database.');
		}

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

				if (process.env.NODE_ENV === 'development') {
					winston.info('[notifications.prune] Notification pruning completed. ' + numPruned + ' expired notification' + (numPruned !== 1 ? 's' : '') + ' removed.');
				}
				var diff = process.hrtime(start);
				events.log('Pruning '+ numPruned + ' notifications took : ' + (diff[0] * 1e3 + diff[1] / 1e6) + ' ms');
			});
		});
	};

}(exports));

