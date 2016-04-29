
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),
	S = require('string'),

	user = require('../user'),
	db = require('../database'),
	meta = require('../meta'),
	notifications = require('../notifications'),
	posts = require('../posts'),
	topics = require('../topics'),
	privileges = require('../privileges'),
	utils = require('../../public/src/utils');

(function(UserNotifications) {

	UserNotifications.get = function(uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null , {read: [], unread: []});
		}
		getNotifications(uid, 0, 9, function(err, notifications) {
			if (err) {
				return callback(err);
			}

			notifications.read = notifications.read.filter(Boolean);
			notifications.unread = notifications.unread.filter(Boolean);

			var maxNotifs = 15;
			if (notifications.read.length + notifications.unread.length > maxNotifs) {
				notifications.read.length = maxNotifs - notifications.unread.length;
			}

			callback(null, notifications);
		});
	};

	UserNotifications.getAll = function(uid, start, stop, callback) {
		getNotifications(uid, start, stop, function(err, notifs) {
			if (err) {
				return callback(err);
			}
			notifs = notifs.unread.concat(notifs.read);
			notifs = notifs.filter(Boolean).sort(function(a, b) {
				return b.datetime - a.datetime;
			});

			callback(null, notifs);
		});
	};

	function getNotifications(uid, start, stop, callback) {
		async.parallel({
			unread: function(next) {
				getNotificationsFromSet('uid:' + uid + ':notifications:unread', false, uid, start, stop, next);
			},
			read: function(next) {
				getNotificationsFromSet('uid:' + uid + ':notifications:read', true, uid, start, stop, next);
			}
		}, callback);
	}

	function getNotificationsFromSet(set, read, uid, start, stop, callback) {
		var setNids;

		async.waterfall([
			async.apply(db.getSortedSetRevRange, set, start, stop),
			function(nids, next) {
				if(!Array.isArray(nids) || !nids.length) {
					return callback(null, []);
				}

				setNids = nids;
				UserNotifications.getNotifications(nids, uid, next);
			},
			function(notifs, next) {
				var deletedNids = [];

				notifs.forEach(function(notification, index) {
					if (!notification) {
						winston.verbose('[notifications.get] nid ' + setNids[index] + ' not found. Removing.');
						deletedNids.push(setNids[index]);
					} else {
						notification.read = read;
						notification.readClass = !notification.read ? 'unread' : '';
					}
				});

				if (deletedNids.length) {
					db.sortedSetRemove(set, deletedNids);
				}

				notifications.merge(notifs, next);
			}
		], callback);
	}

	UserNotifications.getNotifications = function(nids, uid, callback) {
		notifications.getMultiple(nids, function(err, notifications) {
			if (err) {
				return callback(err);
			}

			UserNotifications.generateNotificationPaths(notifications, uid, callback);
		});
	};

	UserNotifications.generateNotificationPaths = function (notifications, uid, callback) {
		var pids = notifications.map(function(notification) {
			return notification ? notification.pid : null;
		});

		generatePostPaths(pids, uid, function(err, pidToPaths) {
			if (err) {
				return callback(err);
			}

			notifications = notifications.map(function(notification, index) {
				if (!notification) {
					return null;
				}

				notification.path = pidToPaths[notification.pid] || notification.path || null;

				if (notification.nid.startsWith('follow')) {
					notification.path = '/user/' + notification.user.userslug;
				}

				notification.datetimeISO = utils.toISOString(notification.datetime);
				return notification;
			}).filter(function(notification) {
				// Remove notifications that do not resolve to a path
				return notification && notification.path !== null;
			});

			callback(null, notifications);
		});
	};

	function generatePostPaths(pids, uid, callback) {
		pids = pids.filter(Boolean);
		var postKeys = pids.map(function(pid) {
			return 'post:' + pid;
		});

		db.getObjectsFields(postKeys, ['pid', 'tid'], function(err, postData) {
			if (err) {
				return callback(err);
			}

			var topicKeys = postData.map(function(post) {
				return post ? 'topic:' + post.tid : null;
			});

			async.parallel({
				indices: function(next) {
					posts.getPostIndices(postData, uid, next);
				},
				topics: function(next) {
					db.getObjectsFields(topicKeys, ['slug', 'deleted'], next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var pidToPaths = {};
				pids.forEach(function(pid, index) {
					if (parseInt(results.topics[index].deleted, 10) === 1) {
						pidToPaths[pid] = null;
						return;
					}

					var slug = results.topics[index] ? results.topics[index].slug : null;
					var postIndex = utils.isNumber(results.indices[index]) ? parseInt(results.indices[index], 10) + 1 : null;

					if (slug && postIndex) {
						pidToPaths[pid] = '/topic/' + slug + '/' + postIndex;
					}
				});

				callback(null, pidToPaths);
			});
		});
	}

	UserNotifications.getDailyUnread = function(uid, callback) {
		var yesterday = Date.now() - (1000 * 60 * 60 * 24);	// Approximate, can be more or less depending on time changes, makes no difference really.

		db.getSortedSetRevRangeByScore('uid:' + uid + ':notifications:unread', 0, 20, '+inf', yesterday, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(nids) || !nids.length) {
				return callback(null, []);
			}

			UserNotifications.getNotifications(nids, uid, callback);
		});
	};

	UserNotifications.getUnreadCount = function(uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, 0);
		}

		// Collapse any notifications with identical mergeIds
		async.waterfall([
			async.apply(db.getSortedSetRevRange, 'uid:' + uid + ':notifications:unread', 0, 99),
			async.apply(notifications.filterExists),
			function(nids, next) {
				var keys = nids.map(function(nid) {
					return 'notifications:' + nid;
				});

				db.getObjectsFields(keys, ['mergeId'], next);
			}
		], function(err, mergeIds) {
			// A missing (null) mergeId means that notification is counted separately.
			mergeIds = mergeIds.map(function(set) {
				return set.mergeId;
			});

			callback(err, mergeIds.reduce(function(count, cur, idx, arr) {
				if (cur === null || idx === arr.indexOf(cur)) {
					++count;
				}

				return count;
			}, 0));
		});
	};

	UserNotifications.getUnreadByField = function(uid, field, value, callback) {
		db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 99, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(nids) || !nids.length) {
				return callback(null, []);
			}

			var keys = nids.map(function(nid) {
				return 'notifications:' + nid;
			});

			db.getObjectsFields(keys, ['nid', field], function(err, notifications) {
				if (err) {
					return callback(err);
				}

				value = value ? value.toString() : '';
				nids = notifications.filter(function(notification) {
					return notification && notification[field] && notification[field].toString() === value;
				}).map(function(notification) {
					return notification.nid;
				});

				callback(null, nids);
			});
		});
	};

	UserNotifications.deleteAll = function(uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback();
		}
		async.parallel([
			function(next) {
				db.delete('uid:' + uid + ':notifications:unread', next);
			},
			function(next) {
				db.delete('uid:' + uid + ':notifications:read', next);
			}
		], callback);
	};

	UserNotifications.sendTopicNotificationToFollowers = function(uid, topicData, postData) {
		db.getSortedSetRange('followers:' + uid, 0, -1, function(err, followers) {
			if (err || !Array.isArray(followers) || !followers.length) {
				return;
			}

			privileges.categories.filterUids('read', topicData.cid, followers, function(err, followers) {
				if (err || !followers.length) {
					return;
				}

				var title = topicData.title;
				if (title) {
					title = S(title).decodeHTMLEntities().s;
				}

				notifications.create({
					bodyShort: '[[notifications:user_posted_topic, ' + postData.user.username + ', ' + title + ']]',
					bodyLong: postData.content,
					pid: postData.pid,
					nid: 'tid:' + postData.tid + ':uid:' + uid,
					tid: postData.tid,
					from: uid
				}, function(err, notification) {
					if (!err && notification) {
						notifications.push(notification, followers);
					}
				});
			});
		});
	};

	UserNotifications.sendWelcomeNotification = function(uid, callback) {
		callback = callback || function() {};
		if (!meta.config.welcomeNotification) {
			return callback();
		}

		var path = meta.config.welcomeLink ? meta.config.welcomeLink : '#';

		notifications.create({
			bodyShort: meta.config.welcomeNotification,
			path: path,
			nid: 'welcome_' + uid
		}, function(err, notification) {
			if (err || !notification) {
				return callback(err);
			}

			notifications.push(notification, [uid], callback);
		});
	};

	UserNotifications.sendNameChangeNotification = function(uid, username) {
		notifications.create({
			bodyShort: '[[user:username_taken_workaround, ' + username + ']]',
			image: 'brand:logo',
			nid: 'username_taken:' + uid,
			datetime: Date.now()
		}, function(err, notification) {
			if (!err && notification) {
				notifications.push(notification, uid);
			}
		});
	};

	UserNotifications.pushCount = function(uid) {
		var websockets = require('./../socket.io');
		UserNotifications.getUnreadCount(uid, function(err, count) {
			if (err) {
				return winston.error(err.stack);
			}

			websockets.in('uid_' + uid).emit('event:notifications.updateCount', count);
		});
	};

}(exports));
