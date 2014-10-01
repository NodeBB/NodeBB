
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
		var maxNotifs = 15;

		async.parallel({
			unread: function(next) {
				getNotificationsFromSet('uid:' + uid + ':notifications:unread', uid, 0, 9, maxNotifs, next);
			},
			read: function(next) {
				getNotificationsFromSet('uid:' + uid + ':notifications:read', uid, 0, 9, maxNotifs, next);
			}
		}, function(err, notifications) {
			if (err) {
				return callback(err);
			}

			notifications.read = notifications.read.filter(Boolean);
			notifications.unread = notifications.unread.filter(Boolean);

			// Limit the number of notifications to `maxNotifs`, prioritising unread notifications
			if (notifications.read.length + notifications.unread.length > maxNotifs) {
				notifications.read.length = maxNotifs - notifications.unread.length;
			}

			callback(null, notifications);
		});
	};

	function getNotificationsFromSet(set, uid, start, stop, max, callback) {
		db.getSortedSetRevRange(set, start, stop, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if(!Array.isArray(nids) || !nids.length) {
				return callback(null, []);
			}

			if (nids.length > max) {
				nids.length = max;
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
		async.parallel({
			unread: function(next) {
				db.getSortedSetRevRange('uid:' + uid + ':notifications:unread', 0, count, next);
			},
			read: function(next) {
				db.getSortedSetRevRange('uid:' + uid + ':notifications:read', 0, count, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var nids = results.unread.concat(results.read);
			UserNotifications.getNotifications(nids, uid, function(err, notifs) {
				if (err) {
					return callback(err);
				}

				notifs = notifs.filter(Boolean).sort(function(a, b) {
					return b.datetime - a.datetime;
				});

				callback(null, notifs);
			});
		});
	};

	UserNotifications.getNotifications = function(nids, uid, callback) {
		notifications.getMultiple(nids, function(err, notifications) {
			if (err) {
				return callback(err);
			}

			db.isSortedSetMembers('uid:' + uid + ':notifications:read', nids, function(err, hasRead) {
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

						notification.read = hasRead[index];
						notification.path = pidToPaths[notification.pid] || notification.path || '';
						notification.datetimeISO = utils.toISOString(notification.datetime);
						notification.readClass = !notification.read ? 'label-warning' : '';
						return notification;
					});

					callback(null, notifications);
				});
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

		db.getSortedSetRangeByScore('uid:' + uid + ':notifications:unread', 0, 20, yesterday, now, function(err, nids) {
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
		db.sortedSetCard('uid:' + uid + ':notifications:unread', callback);
	};

	UserNotifications.getUnreadByField = function(uid, field, value, callback) {
		db.getSortedSetRange('uid:' + uid + ':notifications:unread', 0, -1, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if (!Array.isArray(nids) || !nids.length) {
				return callback(null, []);
			}

			UserNotifications.getNotifications(nids, uid, function(err, notifications) {
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


	UserNotifications.sendPostNotificationToFollowers = function(uid, tid, pid) {
		db.getSetMembers('followers:' + uid, function(err, followers) {
			if (err || !Array.isArray(followers) || !followers.length) {
				return;
			}

			async.parallel({
				username: async.apply(user.getUserField, uid, 'username'),
				topic: async.apply(topics.getTopicFields, tid, ['cid', 'title']),
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

				if (!followers.length) {
					return;
				}

				privileges.categories.filterUids('read', results.topic.cid, followers, function(err, followers) {
					if (err || !followers.length) {
						return;
					}

					notifications.create({
						bodyShort: '[[notifications:user_posted_to, ' + results.username + ', ' + results.topic.title + ']]',
						bodyLong: results.postContent,
						pid: pid,
						nid: 'tid:' + tid + ':pid:' + pid + ':uid:' + uid,
						tid: tid,
						from: uid
					}, function(err, notification) {
						if (!err && notification) {
							notifications.push(notification, followers);
						}
					});
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
