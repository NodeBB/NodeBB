'use strict';

var async = require('async');
var winston = require('winston');
var cron = require('cron').CronJob;
var nconf = require('nconf');
var _ = require('lodash');

var db = require('./database');
var User = require('./user');
var groups = require('./groups');
var meta = require('./meta');
var batch = require('./batch');
var plugins = require('./plugins');
var utils = require('./utils');
var emailer = require('./emailer');

var Notifications = module.exports;

Notifications.baseTypes = [
	'notificationType_upvote',
	'notificationType_new-topic',
	'notificationType_new-reply',
	'notificationType_follow',
	'notificationType_new-chat',
	'notificationType_group-invite',
];

Notifications.privilegedTypes = [
	'notificationType_new-register',
	'notificationType_post-queue',
	'notificationType_new-post-flag',
	'notificationType_new-user-flag',
];

Notifications.getAllNotificationTypes = function (callback) {
	async.waterfall([
		function (next) {
			plugins.fireHook('filter:user.notificationTypes', {
				types: Notifications.baseTypes.slice(),
				privilegedTypes: Notifications.privilegedTypes.slice(),
			}, next);
		},
		function (results, next) {
			next(null, results.types.concat(results.privilegedTypes));
		},
	], callback);
};

Notifications.startJobs = function () {
	winston.verbose('[notifications.init] Registering jobs.');
	new cron('*/30 * * * *', Notifications.prune, null, true);
};

Notifications.get = function (nid, callback) {
	Notifications.getMultiple([nid], function (err, notifications) {
		callback(err, Array.isArray(notifications) && notifications.length ? notifications[0] : null);
	});
};

Notifications.getMultiple = function (nids, callback) {
	if (!Array.isArray(nids) || !nids.length) {
		return setImmediate(callback, null, []);
	}
	var keys = nids.map(function (nid) {
		return 'notifications:' + nid;
	});

	var notifications;

	async.waterfall([
		function (next) {
			db.getObjects(keys, next);
		},
		function (_notifications, next) {
			notifications = _notifications;
			var userKeys = notifications.map(function (notification) {
				return notification && notification.from;
			});

			User.getUsersFields(userKeys, ['username', 'userslug', 'picture'], next);
		},
		function (usersData, next) {
			notifications.forEach(function (notification, index) {
				if (notification) {
					notification.datetimeISO = utils.toISOString(notification.datetime);

					if (notification.bodyLong) {
						notification.bodyLong = utils.escapeHTML(notification.bodyLong);
					}

					notification.user = usersData[index];
					if (notification.user) {
						notification.image = notification.user.picture || null;
						if (notification.user.username === '[[global:guest]]') {
							notification.bodyShort = notification.bodyShort.replace(/([\s\S]*?),[\s\S]*?,([\s\S]*?)/, '$1, [[global:guest]], $2');
						}
					} else if (notification.image === 'brand:logo' || !notification.image) {
						notification.image = meta.config['brand:logo'] || nconf.get('relative_path') + '/logo.png';
					}
				}
			});
			next(null, notifications);
		},
	], callback);
};

Notifications.filterExists = function (nids, callback) {
	async.waterfall([
		function (next) {
			db.isSortedSetMembers('notifications', nids, next);
		},
		function (exists, next) {
			nids = nids.filter(function (notifId, idx) {
				return exists[idx];
			});

			next(null, nids);
		},
	], callback);
};

Notifications.findRelated = function (mergeIds, set, callback) {
	// A related notification is one in a zset that has the same mergeId
	var nids;

	async.waterfall([
		async.apply(db.getSortedSetRevRange, set, 0, -1),
		function (_nids, next) {
			nids = _nids;

			var keys = nids.map(nid => 'notifications:' + nid);
			db.getObjectsFields(keys, ['mergeId'], next);
		},
		function (sets, next) {
			sets = sets.map(set => String(set.mergeId));
			var mergeSet = new Set(mergeIds.map(id => String(id)));
			next(null, nids.filter((nid, idx) => mergeSet.has(sets[idx])));
		},
	], callback);
};

Notifications.create = function (data, callback) {
	if (!data.nid) {
		return callback(new Error('[[error:no-notification-id]]'));
	}
	data.importance = data.importance || 5;
	async.waterfall([
		function (next) {
			db.getObject('notifications:' + data.nid, next);
		},
		function (oldNotification, next) {
			if (oldNotification) {
				if (parseInt(oldNotification.pid, 10) === parseInt(data.pid, 10) && parseInt(oldNotification.importance, 10) > parseInt(data.importance, 10)) {
					return callback(null, null);
				}
			}
			var now = Date.now();
			data.datetime = now;
			async.parallel([
				function (next) {
					db.sortedSetAdd('notifications', now, data.nid, next);
				},
				function (next) {
					db.setObject('notifications:' + data.nid, data, next);
				},
			], function (err) {
				next(err, data);
			});
		},
	], callback);
};

Notifications.push = function (notification, uids, callback) {
	callback = callback || function () {};

	if (!notification || !notification.nid) {
		return callback();
	}

	if (!Array.isArray(uids)) {
		uids = [uids];
	}

	uids = _.uniq(uids);

	if (!uids.length) {
		return callback();
	}

	setTimeout(function () {
		batch.processArray(uids, function (uids, next) {
			pushToUids(uids, notification, next);
		}, { interval: 1000 }, function (err) {
			if (err) {
				winston.error(err.stack);
			}
		});
	}, 1000);

	callback();
};

function pushToUids(uids, notification, callback) {
	function sendNotification(uids, callback) {
		if (!uids.length) {
			return callback();
		}
		var oneWeekAgo = Date.now() - 604800000;
		var unreadKeys = [];
		var readKeys = [];
		async.waterfall([
			function (next) {
				uids.forEach(function (uid) {
					unreadKeys.push('uid:' + uid + ':notifications:unread');
					readKeys.push('uid:' + uid + ':notifications:read');
				});

				db.sortedSetsAdd(unreadKeys, notification.datetime, notification.nid, next);
			},
			function (next) {
				db.sortedSetsRemove(readKeys, notification.nid, next);
			},
			function (next) {
				db.sortedSetsRemoveRangeByScore(unreadKeys, '-inf', oneWeekAgo, next);
			},
			function (next) {
				db.sortedSetsRemoveRangeByScore(readKeys, '-inf', oneWeekAgo, next);
			},
			function (next) {
				var websockets = require('./socket.io');
				if (websockets.server) {
					uids.forEach(function (uid) {
						websockets.in('uid_' + uid).emit('event:new_notification', notification);
					});
				}
				next();
			},
		], callback);
	}

	function sendEmail(uids, callback) {
		async.eachLimit(uids, 3, function (uid, next) {
			emailer.send('notification', uid, {
				path: notification.path,
				subject: utils.stripHTMLTags(notification.subject || '[[notifications:new_notification]]'),
				intro: utils.stripHTMLTags(notification.bodyShort),
				body: notification.bodyLong || '',
				notification: notification,
				showUnsubscribe: true,
			}, next);
		}, callback);
	}

	function getUidsBySettings(uids, callback) {
		var uidsToNotify = [];
		var uidsToEmail = [];
		async.waterfall([
			function (next) {
				User.getMultipleUserSettings(uids, next);
			},
			function (usersSettings, next) {
				usersSettings.forEach(function (userSettings) {
					var setting = userSettings['notificationType_' + notification.type] || 'notification';

					if (setting === 'notification' || setting === 'notificationemail') {
						uidsToNotify.push(userSettings.uid);
					}

					if (setting === 'email' || setting === 'notificationemail') {
						uidsToEmail.push(userSettings.uid);
					}
				});
				next(null, { uidsToNotify: uidsToNotify, uidsToEmail: uidsToEmail });
			},
		], callback);
	}

	async.waterfall([
		function (next) {
			// Remove uid from recipients list if they have blocked the user triggering the notification
			User.blocks.filterUids(notification.from, uids, next);
		},
		function (uids, next) {
			plugins.fireHook('filter:notification.push', { notification: notification, uids: uids }, next);
		},
		function (data, next) {
			if (!data || !data.notification || !data.uids || !data.uids.length) {
				return callback();
			}
			notification = data.notification;
			if (notification.type) {
				getUidsBySettings(data.uids, next);
			} else {
				next(null, { uidsToNotify: data.uids, uidsToEmail: [] });
			}
		},
		function (results, next) {
			async.parallel([
				function (next) {
					sendNotification(results.uidsToNotify, next);
				},
				function (next) {
					sendEmail(results.uidsToEmail, next);
				},
			], function (err) {
				next(err, results);
			});
		},
		function (results, next) {
			plugins.fireHook('action:notification.pushed', {
				notification: notification,
				uids: results.uidsToNotify,
				uidsNotified: results.uidsToNotify,
				uidsEmailed: results.uidsToEmail,
			});
			next();
		},
	], callback);
}

Notifications.pushGroup = function (notification, groupName, callback) {
	callback = callback || function () {};
	async.waterfall([
		function (next) {
			groups.getMembers(groupName, 0, -1, next);
		},
		function (members, next) {
			Notifications.push(notification, members, next);
		},
	], callback);
};

Notifications.pushGroups = function (notification, groupNames, callback) {
	callback = callback || function () {};
	async.waterfall([
		function (next) {
			groups.getMembersOfGroups(groupNames, next);
		},
		function (groupMembers, next) {
			var members = _.uniq(_.flatten(groupMembers));
			Notifications.push(notification, members, next);
		},
	], callback);
};

Notifications.rescind = function (nid, callback) {
	callback = callback || function () {};

	async.parallel([
		async.apply(db.sortedSetRemove, 'notifications', nid),
		async.apply(db.delete, 'notifications:' + nid),
	], function (err) {
		callback(err);
	});
};

Notifications.markRead = function (nid, uid, callback) {
	callback = callback || function () {};
	if (parseInt(uid, 10) <= 0 || !nid) {
		return setImmediate(callback);
	}
	Notifications.markReadMultiple([nid], uid, callback);
};

Notifications.markUnread = function (nid, uid, callback) {
	callback = callback || function () {};
	if (parseInt(uid, 10) <= 0 || !nid) {
		return setImmediate(callback);
	}
	async.waterfall([
		function (next) {
			db.getObject('notifications:' + nid, next);
		},
		function (notification, next) {
			if (!notification) {
				return callback(new Error('[[error:no-notification]]'));
			}
			notification.datetime = notification.datetime || Date.now();

			async.parallel([
				async.apply(db.sortedSetRemove, 'uid:' + uid + ':notifications:read', nid),
				async.apply(db.sortedSetAdd, 'uid:' + uid + ':notifications:unread', notification.datetime, nid),
			], next);
		},
	], function (err) {
		callback(err);
	});
};

Notifications.markReadMultiple = function (nids, uid, callback) {
	callback = callback || function () {};
	nids = nids.filter(Boolean);
	if (!Array.isArray(nids) || !nids.length) {
		return callback();
	}

	var notificationKeys = nids.map(function (nid) {
		return 'notifications:' + nid;
	});

	async.waterfall([
		async.apply(db.getObjectsFields, notificationKeys, ['mergeId']),
		function (mergeIds, next) {
			// Isolate mergeIds and find related notifications
			mergeIds = mergeIds.map(function (set) {
				return set.mergeId;
			}).reduce(function (memo, mergeId, idx, arr) {
				if (mergeId && idx === arr.indexOf(mergeId)) {
					memo.push(mergeId);
				}
				return memo;
			}, []);

			Notifications.findRelated(mergeIds, 'uid:' + uid + ':notifications:unread', next);
		},
		function (relatedNids, next) {
			notificationKeys = _.union(nids, relatedNids).map(function (nid) {
				return 'notifications:' + nid;
			});

			db.getObjectsFields(notificationKeys, ['nid', 'datetime'], next);
		},
		function (notificationData, next) {
			// Filter out notifications that didn't exist
			notificationData = notificationData.filter(function (notification) {
				return notification && notification.nid;
			});

			// Extract nid
			nids = notificationData.map(function (notification) {
				return notification.nid;
			});

			var datetimes = notificationData.map(function (notification) {
				return (notification && notification.datetime) || Date.now();
			});

			async.parallel([
				function (next) {
					db.sortedSetRemove('uid:' + uid + ':notifications:unread', nids, next);
				},
				function (next) {
					db.sortedSetAdd('uid:' + uid + ':notifications:read', datetimes, nids, next);
				},
			], next);
		},
	], function (err) {
		callback(err);
	});
};

Notifications.markAllRead = function (uid, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 99, next);
		},
		function (nids, next) {
			Notifications.markReadMultiple(nids, uid, next);
		},
	], callback);
};

Notifications.prune = function (callback) {
	callback = callback || function () {};
	var week = 604800000;

	var cutoffTime = Date.now() - week;

	async.waterfall([
		function (next) {
			db.getSortedSetRangeByScore('notifications', 0, 500, '-inf', cutoffTime, next);
		},
		function (nids, next) {
			if (!nids.length) {
				return callback();
			}

			var keys = nids.map(function (nid) {
				return 'notifications:' + nid;
			});

			async.parallel([
				function (next) {
					db.sortedSetRemove('notifications', nids, next);
				},
				function (next) {
					db.deleteAll(keys, next);
				},
			], next);
		},
	], function (err) {
		if (err) {
			winston.error('Encountered error pruning notifications', err);
		}
		callback(err);
	});
};

Notifications.merge = function (notifications, callback) {
	// When passed a set of notification objects, merge any that can be merged
	var mergeIds = [
		'notifications:upvoted_your_post_in',
		'notifications:user_started_following_you',
		'notifications:user_posted_to',
		'notifications:user_flagged_post_in',
		'notifications:user_flagged_user',
		'new_register',
	];
	var isolated;
	var differentiators;
	var differentiator;
	var modifyIndex;
	var set;

	notifications = mergeIds.reduce(function (notifications, mergeId) {
		isolated = notifications.filter(function (notifObj) {
			if (!notifObj || !notifObj.hasOwnProperty('mergeId')) {
				return false;
			}

			return notifObj.mergeId.split('|')[0] === mergeId;
		});

		if (isolated.length <= 1) {
			return notifications;	// Nothing to merge
		}

		// Each isolated mergeId may have multiple differentiators, so process each separately
		differentiators = isolated.reduce(function (cur, next) {
			differentiator = next.mergeId.split('|')[1] || 0;
			if (!cur.includes(differentiator)) {
				cur.push(differentiator);
			}

			return cur;
		}, []);

		differentiators.forEach(function (differentiator) {
			if (differentiator === 0 && differentiators.length === 1) {
				set = isolated;
			} else {
				set = isolated.filter(function (notifObj) {
					return notifObj.mergeId === (mergeId + '|' + differentiator);
				});
			}

			modifyIndex = notifications.indexOf(set[0]);
			if (modifyIndex === -1 || set.length === 1) {
				return notifications;
			}

			switch (mergeId) {
			// intentional fall-through
			case 'notifications:upvoted_your_post_in':
			case 'notifications:user_started_following_you':
			case 'notifications:user_posted_to':
			case 'notifications:user_flagged_post_in':
			case 'notifications:user_flagged_user':
				var usernames = set.map(function (notifObj) {
					return notifObj && notifObj.user && notifObj.user.username;
				}).filter(function (username, idx, array) {
					return array.indexOf(username) === idx;
				});
				var numUsers = usernames.length;

				var title = utils.decodeHTMLEntities(notifications[modifyIndex].topicTitle || '');
				var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
				titleEscaped = titleEscaped ? (', ' + titleEscaped) : '';

				if (numUsers === 2) {
					notifications[modifyIndex].bodyShort = '[[' + mergeId + '_dual, ' + usernames.join(', ') + titleEscaped + ']]';
				} else if (numUsers > 2) {
					notifications[modifyIndex].bodyShort = '[[' + mergeId + '_multiple, ' + usernames[0] + ', ' + (numUsers - 1) + titleEscaped + ']]';
				}

				notifications[modifyIndex].path = set[set.length - 1].path;
				break;

			case 'new_register':
				notifications[modifyIndex].bodyShort = '[[notifications:' + mergeId + '_multiple, ' + set.length + ']]';
				break;
			}

			// Filter out duplicates
			notifications = notifications.filter(function (notifObj, idx) {
				if (!notifObj || !notifObj.mergeId) {
					return true;
				}

				return !(notifObj.mergeId === (mergeId + (differentiator ? '|' + differentiator : '')) && idx !== modifyIndex);
			});
		});

		return notifications;
	}, notifications);

	plugins.fireHook('filter:notifications.merge', {
		notifications: notifications,
	}, function (err, data) {
		callback(err, data.notifications);
	});
};

Notifications.async = require('./promisify')(Notifications);
