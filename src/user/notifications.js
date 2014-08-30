
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
		db.getSortedSetRevRange(set, start, stop, function(err, uniqueIds) {
			if (err) {
				return callback(err);
			}

			if(!Array.isArray(uniqueIds) || !uniqueIds.length) {
				return callback(null, []);
			}

			if (uniqueIds.length > max) {
				uniqueIds.length = max;
			}

			db.getObjectFields('uid:' + uid + ':notifications:uniqueId:nid', uniqueIds, function(err, uniqueIdToNids) {
				if (err) {
					return callback(err);
				}

				var nidsToUniqueIds = {};
				var nids = [];
				uniqueIds.forEach(function(uniqueId) {
					nidsToUniqueIds[uniqueIdToNids[uniqueId]] = uniqueId;
					nids.push(uniqueIdToNids[uniqueId]);
				});

				UserNotifications.getNotifications(nids, uid, function(err, notifications) {
					if (err) {
						return callback(err);
					}

					notifications.forEach(function(notification, index) {
						if (!notification) {
							if (process.env.NODE_ENV === 'development') {
								winston.info('[notifications.get] nid ' + nids[index] + ' not found. Removing.');
							}

							db.sortedSetRemove(set, nidsToUniqueIds[nids[index]]);
							db.deleteObjectField('uid:' + uid + ':notifications:uniqueId:nid', nidsToUniqueIds[nids[index]]);
						}
					});

					callback(null, notifications);
				});
			});
		});
	}

	UserNotifications.getAll = function(uid, limit, callback) {
		if (!limit || parseInt(limit, 10) <= 0) {
			limit = 25;
		}

		db.getObjectValues('uid:' + uid + ':notifications:uniqueId:nid', function(err, nids) {
			if (err) {
				return callback(err);
			}

			UserNotifications.getNotifications(nids, uid, function(err, notifs) {
				if (err) {
					return callback(err);
				}

				notifs = notifs.filter(Boolean).sort(function(a, b) {
					return parseInt(b.datetime, 10) - parseInt(a.datetime, 10);
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

			var uniqueIds = notifications.map(function(notification) {
				return notification ? notification.uniqueId : null;
			});

			db.isSortedSetMembers('uid:' + uid + ':notifications:read', uniqueIds, function(err, hasRead) {
				if (err) {
					return callback(err);
				}

				var pids = notifications.map(function(notification) {
					return notification ? notification.pid : null;
				});

				generatePostPaths(pids, uid, function(err, paths) {
					if (err) {
						return callback(err);
					}

					notifications = notifications.map(function(notification, index) {
						if (!notification) {
							return null;
						}

						notification.read = hasRead[index];
						notification.path = paths[index] || notification.path || '';
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

				var paths = [];
				pids.forEach(function(pid, index) {
					var slug = results.topics[index] ? results.topics[index].slug : null;
					var postIndex = utils.isNumber(results.indices[index]) ? parseInt(results.indices[index], 10) + 1 : null;

					if (slug && postIndex) {
						paths.push(nconf.get('relative_path') + '/topic/' + slug + '/' + postIndex);
					} else {
						paths.push(null);
					}
				});
				callback(null, paths);
			});
		});
	}

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

				UserNotifications.getNotifications(nids, uid, callback);
			});
		});
	};

	UserNotifications.getUnreadCount = function(uid, callback) {
		db.sortedSetCard('uid:' + uid + ':notifications:unread', callback);
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

				UserNotifications.getNotifications(nids, uid, function(err, notifications) {
					if (err) {
						return callback(err);
					}

					notifications = notifications.filter(function(notification) {
						return notification && notification[field] !== value.toString();
					}).map(function(notification) {
						return notification.nid;
					});

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

				notifications.create({
					bodyShort: '[[notifications:user_posted_to, ' + results.username + ', ' + results.topic.title + ']]',
					bodyLong: results.postContent,
					pid: pid,
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
