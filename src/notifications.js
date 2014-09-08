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

				notification.bodyShort = S(notification.bodyShort).escapeHTML().s;
				notification.bodyLong = S(notification.bodyLong).escapeHTML().s;

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
				}

			}, callback);
		});
	};

	Notifications.create = function(data, callback) {
		// Add default values to data Object if not already set
		var	defaults = {
				bodyShort: '',
				bodyLong: '',
				importance: 5,
				datetime: Date.now(),
				uniqueId: utils.generateUUID()
			};

		for(var v in defaults) {
			if (defaults.hasOwnProperty(v) && !data[v]) {
				data[v] = defaults[v];
			}
		}

		// Backwards compatibility for old notification schema
		// Remove this block for NodeBB v0.6.0
		if (data.hasOwnProperty('text')) {
			data.bodyShort = data.text;
			data.bodyLong = '';
			delete data.text;
		}

		db.incrObjectField('global', 'nextNid', function(err, nid) {
			if (err) {
				return callback(err);
			}

			data.nid = nid;
			db.setAdd('notifications', nid);
			db.setObject('notifications:' + nid, data, function(err) {
				callback(err, nid);
			});
		});
	};

	Notifications.push = function(nid, uids, callback) {
		callback = callback || function() {};
		var websockets = require('./socket.io');
		if (!Array.isArray(uids)) {
			uids = [uids];
		}

		Notifications.get(nid, function(err, notif_data) {
			if (err) {
				return callback(err);
			}

			async.eachLimit(uids, 10, function(uid, next) {
				if (!parseInt(uid, 10)) {
					return next();
				}

				shouldPush(uid, notif_data, function(err, shouldPush) {
					if (err || !shouldPush) {
						return callback(err);
					}

					async.parallel([
						async.apply(db.setObjectField, 'uid:' + uid + ':notifications:uniqueId:nid', notif_data.uniqueId, nid),
						async.apply(db.sortedSetAdd, 'uid:' + uid + ':notifications:unread', notif_data.datetime, notif_data.uniqueId),
						async.apply(db.sortedSetRemove, 'uid:' + uid + ':notifications:read', notif_data.uniqueId)
					], function(err) {
						if (err) {
							return next(err);
						}

						User.notifications.getUnreadCount(uid, function(err, count) {
							if (!err) {
								websockets.in('uid_' + uid).emit('event:new_notification', notif_data, count);
							}
						});

						// Plugins
						notif_data.uid = uid;
						plugins.fireHook('action:notification.pushed', notif_data);
						next();
					});
				});
			}, callback);
		});
	};

	function shouldPush(uid, newNotifObj, callback) {
		if (!newNotifObj) {
			return callback(null, false);
		}

		hasNotification(newNotifObj.uniqueId, uid, function(err, hasNotification) {
			if (err) {
				return callback(err);
			}

			if (!hasNotification) {
				return callback(null, true);
			}

			db.getObjectField('uid:' + uid + ':notifications:uniqueId:nid', newNotifObj.uniqueId, function(err, nid) {
				if (err) {
					return callback(err);
				}

				db.getObjectFields('notifications:' + nid, ['nid', 'uniqueId', 'importance'], function(err, oldNotifObj) {
					if (err) {
						return callback(err);
					}

					if (!oldNotifObj || newNotifObj.uniqueId !== oldNotifObj.uniqueId) {
						return callback(null, true);
					}

					callback(null, parseInt(newNotifObj.importance, 10) >= parseInt(oldNotifObj.importance, 10));
				});
			});
		});
	}

	function hasNotification(uniqueId, uid, callback) {
		async.parallel([
			async.apply(db.isSortedSetMember, 'uid:' + uid + ':notifications:unread', uniqueId),
			async.apply(db.isSortedSetMember, 'uid:' + uid + ':notifications:read', uniqueId)
		], function(err, results) {
			if (err) {
				return callback(err);
			}

			callback(null, results[0] || results[1]);
		});
	}

	Notifications.pushGroup = function(nid, groupName, callback) {
		callback = callback || function() {};
		groups.get(groupName, {}, function(err, groupObj) {
			if (err || !groupObj || !Array.isArray(groupObj.members) || !groupObj.members.length) {
				return callback(err);
			}

			Notifications.push(nid, groupObj.members, callback);
		});
	};


	Notifications.markRead = function(nid, uid, callback) {
		callback = callback || function() {};
		if (!parseInt(uid, 10) || !parseInt(nid, 10)) {
			return callback();
		}

		db.getObjectFields('notifications:' + nid, ['uniqueId', 'datetime'], function(err, notificationData) {
			if (err || !notificationData)  {
				return callback(err);
			}

			async.parallel([
				async.apply(db.sortedSetRemove, 'uid:' + uid + ':notifications:unread', notificationData.uniqueId),
				async.apply(db.sortedSetAdd, 'uid:' + uid + ':notifications:read', notificationData.datetime, notificationData.uniqueId)
			], callback);
		});
	};

	Notifications.markReadMultiple = function(nids, uid, callback) {
		callback = callback || function() {};
		if (!nids) {
			return callback(null);
		}
		if (!Array.isArray(nids) && parseInt(nids, 10) > 0) {
			nids = [nids];
		}

		async.each(nids, function(nid, next) {
			Notifications.markRead(nid, uid, next);
		}, callback);
	};

	Notifications.markAllRead = function(uid, callback) {
		db.getObjectValues('uid:' + uid + ':notifications:uniqueId:nid', function(err, nids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(nids) || !nids.length) {
				return callback(err);
			}

			Notifications.markReadMultiple(nids, uid, callback);
		});
	};

	Notifications.markReadByUniqueId = function(uid, uniqueId, callback) {
		async.waterfall([
			async.apply(db.getObjectField, 'uid:' + uid + ':notifications:uniqueId:nid', uniqueId),
			function(nid, next) {
				Notifications.markRead(nid, uid, next);
			}
		], callback);
	};

	Notifications.prune = function(cutoff) {
		var start = process.hrtime();

		if (process.env.NODE_ENV === 'development') {
			winston.info('[notifications.prune] Removing expired notifications from the database.');
		}

		var	today = new Date(),
			numPruned = 0;

		if (!cutoff) {
			cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
		}

		var	cutoffTime = cutoff.getTime();

		db.getSetMembers('notifications', function(err, nids) {
			if (err) {
				return winston.error(err.message);
			}
			var totalNidCount = nids.length;
			nids = _.sortBy(nids, function(num) { return parseInt(num, 10); }).slice(0, 500);

			var keys = nids.map(function(nid) {
				return 'notifications:' + nid;
			});

			db.getObjectsFields(keys, ['nid', 'datetime'], function(err, notifs) {
				if (err) {
					return winston.error(err.message);
				}

				var expiredNids = nids.filter(function(nids, index) {
					return !notifs[index].nid || parseInt(notifs[index].datetime, 10) < cutoffTime;
				}).filter(Boolean);

				keys = expiredNids.map(function(nid) {
					return 'notifications:' + nid;
				});

				numPruned = expiredNids.length;

				events.log('Notification pruning. Total nids = ' + totalNidCount + '. Expired Nids = ' + numPruned);

				async.parallel([
					function(next) {
						db.setRemove('notifications', expiredNids, next);
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
		});
	};

}(exports));

