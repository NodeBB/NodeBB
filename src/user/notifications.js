
'use strict';

var async = require('async'),
	nconf = require('nconf'),
	winston = require('winston'),

	user = require('../user'),
	utils = require('../../public/src/utils'),
	db = require('../database'),
	meta = require('../meta'),
	notifications = require('../notifications'),
	posts = require('../posts'),
	postTools = require('../postTools'),
	topics = require('../topics'),
	privileges = require('../privileges'),
	utils = require('../../public/src/utils');

(function(UserNotifications) {

	UserNotifications.get = function(uid, callback) {
		getNotifications(uid, 10, function(err, notifications) {
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

	function getNotifications(uid, count, callback) {
		async.parallel({
			unread: function(next) {
				getNotificationsFromSet('uid:' + uid + ':notifications:unread', false, uid, 0, count - 1, next);
			},
			read: function(next) {
				getNotificationsFromSet('uid:' + uid + ':notifications:read', true, uid, 0, count - 1, next);
			}
		}, callback);
	}

	function getNotificationsFromSet(set, read, uid, start, stop, callback) {
		db.getSortedSetRevRange(set, start, stop, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if(!Array.isArray(nids) || !nids.length) {
				return callback(null, []);
			}

			UserNotifications.getNotifications(nids, uid, function(err, notifications) {
				if (err) {
					return callback(err);
				}

				var deletedNids = [];

				notifications.forEach(function(notification, index) {
					if (!notification) {
						if (process.env.NODE_ENV === 'development') {
							winston.info('[notifications.get] nid ' + nids[index] + ' not found. Removing.');
						}

						deletedNids.push(nids[index]);
					} else {
						notification.read = read;
						notification.readClass = !notification.read ? 'label-warning' : '';
					}
				});

				if (deletedNids.length) {
					db.sortedSetRemove(set, deletedNids);
				}

				callback(null, notifications);
			});
		});
	}

	UserNotifications.getAll = function(uid, count, callback) {
		getNotifications(uid, count, function(err, notifs) {
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

	UserNotifications.getNotifications = function(nids, uid, callback) {
		notifications.getMultiple(nids, function(err, notifications) {
			if (err) {
				return callback(err);
			}

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

					notification.path = pidToPaths[notification.pid] || notification.path || '';
					notification.datetimeISO = utils.toISOString(notification.datetime);
					return notification;
				});

				callback(null, notifications);
			});
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
					db.getObjectsFields(topicKeys, ['slug'], next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}

				var pidToPaths = {};
				pids.forEach(function(pid, index) {
					var slug = results.topics[index] ? results.topics[index].slug : null;
					var postIndex = utils.isNumber(results.indices[index]) ? parseInt(results.indices[index], 10) + 1 : null;

					if (slug && postIndex) {
						pidToPaths[pid] = nconf.get('relative_path') + '/topic/' + slug + '/' + postIndex;
					}
				});

				callback(null, pidToPaths);
			});
		});
	}

	UserNotifications.getDailyUnread = function(uid, callback) {
		var	now = Date.now(),
			yesterday = now - (1000*60*60*24);	// Approximate, can be more or less depending on time changes, makes no difference really.

		db.getSortedSetRevRangeByScore('uid:' + uid + ':notifications:unread', 0, 20, now, yesterday, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(nids) || !nids.length) {
				return callback(null, []);
			}

			UserNotifications.getNotifications(nids, uid);
		});
	};

	UserNotifications.getUnreadCount = function(uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, 0);
		}
		db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, 20, function(err, nids) {
			callback(err, Array.isArray(nids) ? nids.length : 0);
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
					return notification && notification[field] === value;
				}).map(function(notification) {
					return notification.nid;
				});

				callback(null, nids);
			});
		});
	};

	UserNotifications.sendTopicNotificationToFollowers = function(uid, topicData, postData) {
		db.getSetMembers('followers:' + uid, function(err, followers) {
			if (err || !Array.isArray(followers) || !followers.length) {
				return;
			}

			privileges.categories.filterUids('read', topicData.cid, followers, function(err, followers) {
				if (err || !followers.length) {
					return;
				}

				notifications.create({
					bodyShort: '[[notifications:user_posted_topic, ' + postData.user.username + ', ' + topicData.title + ']]',
					bodyLong: postData.content,
					pid: postData.pid,
					nid: 'tid:' + postData.tid + ':pid:' + postData.pid + ':uid:' + uid,
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

	UserNotifications.sendWelcomeNotification = function(uid) {
		if (!meta.config.welcomeNotification) {
			return;
		}

		var path = meta.config.welcomeLink ? meta.config.welcomeLink : '#';

		notifications.create({
			bodyShort: meta.config.welcomeNotification,
			bodyLong: meta.config.welcomeNotification,
			path: path,
			nid: 'welcome_' + uid
		}, function(err, notification) {
			if (!err && notification) {
				notifications.push(notification, [uid]);
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
