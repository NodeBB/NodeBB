'use strict';

var async = require('async');
var winston = require('winston');
var cron = require('cron').CronJob;
var nconf = require('nconf');
var S = require('string');
var _ = require('underscore');

var db = require('./database');
var User = require('./user');
var groups = require('./groups');
var meta = require('./meta');
var plugins = require('./plugins');

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

						if (userData.username === '[[global:guest]]') {
							notification.bodyShort = notification.bodyShort.replace(/([\s\S]*?),[\s\S]*?,([\s\S]*?)/, '$1, [[global:guest]], $2');
						}

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

	Notifications.filterExists = function(nids, callback) {
		// Removes nids that have been pruned
		db.isSortedSetMembers('notifications', nids, function(err, exists) {
			if (err) {
				return callbacK(err);
			}

			nids = nids.filter(function(notifId, idx) {
				return exists[idx];
			});

			callback(null, nids);
		});
	};

	Notifications.findRelated = function(mergeIds, set, callback) {
		// A related notification is one in a zset that has the same mergeId
		var _nids;

		async.waterfall([
			async.apply(db.getSortedSetRevRange, set, 0, -1),
			function(nids, next) {
				_nids = nids;

				var keys = nids.map(function(nid) {
					return 'notifications:' + nid;
				});

				db.getObjectsFields(keys, ['mergeId'], next);
			},
		], function(err, sets) {
			if (err) {
				return callback(err);
			}

			sets = sets.map(function(set) {
				return set.mergeId;
			});

			callback(null, _nids.filter(function(nid, idx) {
				return mergeIds.indexOf(sets[idx]) !== -1;
			}));
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
					return callback(null, null);
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

		uids = uids.filter(function(uid, index, array) {
			return parseInt(uid, 10) && array.indexOf(uid) === index;
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
		var oneWeekAgo = Date.now() - 604800000;
		var unreadKeys = [];
		var readKeys = [];

		async.waterfall([
			function (next) {
				plugins.fireHook('filter:notification.push', {notification: notification, uids: uids}, next);
			},
			function (data, next) {
				uids = data.uids;
				notification = data.notification;

				uids.forEach(function(uid) {
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
					uids.forEach(function(uid) {
						websockets.in('uid_' + uid).emit('event:new_notification', notification);
					});
				}

				plugins.fireHook('action:notification.pushed', {notification: notification, uids: uids});
				next();
			}
		], callback);
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

		async.waterfall([
			async.apply(db.getObjectsFields, notificationKeys, ['mergeId']),
			function(mergeIds, next) {
				// Isolate mergeIds and find related notifications
				mergeIds = mergeIds.map(function(set) {
					return set.mergeId;
				}).reduce(function(memo, mergeId, idx, arr) {
					if (mergeId && idx === arr.indexOf(mergeId)) {
						memo.push(mergeId);
					}
					return memo;
				}, []);

				Notifications.findRelated(mergeIds, 'uid:' + uid + ':notifications:unread', next);
			},
			function(relatedNids, next) {
				notificationKeys = _.union(nids, relatedNids).map(function(nid) {
					return 'notifications:' + nid;
				});

				db.getObjectsFields(notificationKeys, ['nid', 'datetime'], next);
			}
		], function(err, notificationData) {
			if (err) {
				return callback(err);
			}

			// Filter out notifications that didn't exist
			notificationData = notificationData.filter(function(notification) {
				return notification && notification.nid;
			});

			// Extract nid
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

		db.getSortedSetRangeByScore('notifications', 0, 500, '-inf', cutoffTime, function(err, nids) {
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
				'notifications:user_flagged_post_in',
				'new_register'
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
				differentiator = next.mergeId.split('|')[1] || 0;
				if (cur.indexOf(differentiator) === -1) {
					cur.push(differentiator);
				}

				return cur;
			}, []);

			differentiators.forEach(function(differentiator) {
				if (differentiator === 0 && differentiators.length === 1) {
					set = isolated;
				} else {
					set = isolated.filter(function(notifObj) {
						return notifObj.mergeId === (mergeId + '|' + differentiator);
					});
				}

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
							return notifObj && notifObj.user && notifObj.user.username;
						}).filter(function(username, idx, array) {
							return array.indexOf(username) === idx;
						});
						var numUsers = usernames.length;

						var title = S(notifications[modifyIndex].topicTitle || '').decodeHTMLEntities().s;
						var titleEscaped = title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');
						titleEscaped = titleEscaped ? (', ' + titleEscaped) : '';

						if (numUsers === 2) {
							notifications[modifyIndex].bodyShort = '[[' + mergeId + '_dual, ' + usernames.join(', ') + titleEscaped + ']]';
						} else if (numUsers > 2) {
							notifications[modifyIndex].bodyShort = '[[' + mergeId + '_multiple, ' + usernames[0] + ', ' + (numUsers - 1) + titleEscaped + ']]';
						}
						break;

					case 'new_register':
						notifications[modifyIndex].bodyShort = '[[notifications:' + mergeId + '_multiple, ' + set.length + ']]';
						break;
				}

				// Filter out duplicates
				notifications = notifications.filter(function(notifObj, idx) {
					if (!notifObj || !notifObj.mergeId) {
						return true;
					}

					return !(notifObj.mergeId === (mergeId + (differentiator ? '|' + differentiator : '')) && idx !== modifyIndex);
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

