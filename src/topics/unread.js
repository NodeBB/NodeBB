
'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	meta = require('../meta'),
	notifications = require('../notifications'),
	categories = require('../categories'),
	privileges = require('../privileges');

module.exports = function(Topics) {

	Topics.getTotalUnread = function(uid, callback) {
		Topics.getUnreadTids(uid, 0, 20, function(err, tids) {
			callback(err, tids ? tids.length : 0);
		});
	};

	Topics.getUnreadTopics = function(uid, start, stop, callback) {

		var unreadTopics = {
			showSelect: true,
			nextStart : 0,
			topics: []
		};

		function sendUnreadTopics(tids, callback) {
			if (!tids.length) {
				return callback(null, unreadTopics);
			}

			Topics.getTopicsByTids(tids, uid, function(err, topicData) {
				if (err) {
					return callback(err);
				}

				if (!Array.isArray(topicData) || !topicData.length) {
					return callback(null, unreadTopics);
				}

				db.sortedSetRevRank('topics:recent', topicData[topicData.length - 1].tid, function(err, rank) {
					if (err) {
						return callback(err);
					}

					unreadTopics.topics = topicData;
					unreadTopics.nextStart = parseInt(rank, 10) + 1;

					callback(null, unreadTopics);
				});
			});
		}

		Topics.getUnreadTids(uid, start, stop, function(err, unreadTids) {
			if (err) {
				return callback(err);
			}

			sendUnreadTopics(unreadTids, callback);
		});
	};

	Topics.getUnreadTids = function(uid, start, stop, callback) {
		var unreadTids = [],
			done = false;

		uid = parseInt(uid, 10);
		if (uid === 0) {
			return callback(null, unreadTids);
		}

		var count = 0;
		if (stop === -1) {
			count = Infinity;
		} else {
			count = stop - start + 1;
		}

		user.getIgnoredCategories(uid, function(err, ignoredCids) {
			if (err) {
				return callback(err);
			}

			async.whilst(function() {
				return unreadTids.length < count && !done;
			}, function(next) {
				Topics.getLatestTids(start, stop, 'day', function(err, tids) {
					if (err) {
						return next(err);
					}

					if (tids && !tids.length) {
						done = true;
						return next();
					}

					Topics.hasReadTopics(tids, uid, function(err, read) {
						if (err) {
							return next(err);
						}

						var newtids = tids.filter(function(tid, index) {
							return !read[index];
						});

						privileges.topics.filter('read', newtids, uid, function(err, newtids) {
							if (err) {
								return next(err);
							}

							filterTopicsFromIgnoredCategories(newtids, ignoredCids, function(err, newtids) {
								if (err) {
									return next(err);
								}

								unreadTids.push.apply(unreadTids, newtids);

								start = stop + 1;
								stop = start + 19;

								next();
							});
						});
					});
				});
			}, function(err) {
				callback(err, unreadTids.slice(0, count));
			});

		});
	};

	function filterTopicsFromIgnoredCategories(tids, ignoredCids, callback) {
		if (!Array.isArray(ignoredCids) || !ignoredCids.length || !tids.length) {
			return callback(null, tids);
		}

		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});

		db.getObjectsFields(keys, ['tid', 'cid'], function(err, topics) {
			if (err) {
				return callback(err);
			}
			topics = topics.filter(function(topic) {
				return topic && ignoredCids.indexOf(topic.cid.toString()) === -1;
			}).map(function(topic) {
				return topic.tid;
			});

			callback(null, topics);
		});
	}

	Topics.pushUnreadCount = function(uid, callback) {
		callback = callback || function() {}:

		if (!uid || parseInt(uid, 10) === 0) {
			return callback();
		}
		Topics.getTotalUnread(uid, function(err, count) {
			if (err) {
				return callback(err);
			}
			require('../socket.io').in('uid_' + uid).emit('event:unread.updateCount', null, count);
			callback();
		});
	};

	Topics.markAsUnreadForAll = function(tid, callback) {
		db.delete('tid:' + tid + ':read_by_uid', function(err) {
			if(err) {
				return callback(err);
			}
			Topics.markCategoryUnreadForAll(tid, callback);
		});
	};

	Topics.markAsRead = function(tids, uid, callback) {
		callback = callback || function() {};
		if (!Array.isArray(tids) || !tids.length) {
			return callback();
		}
		tids = tids.filter(Boolean);
		var keys = tids.map(function(tid) {
			return 'tid:' + tid + ':read_by_uid';
		});

		async.parallel({
			markRead: function(next) {
				db.setsAdd(keys, uid, next);
			},
			topicData: function(next) {
				Topics.getTopicsFields(tids, ['cid'], next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			var cids = results.topicData.map(function(topic) {
				return topic && topic.cid;
			}).filter(function(topic, index, array) {
				return topic && array.indexOf(topic) === index;
			});

			categories.markAsRead(cids, uid, callback);
		});
	};

	Topics.markTopicNotificationsRead = function(tid, uid) {
		user.notifications.getUnreadByField(uid, 'tid', tid, function(err, nids) {
			if (err) {
				return winston.error(err.stack);
			}
			notifications.markReadMultiple(nids, uid, function() {
				user.notifications.pushCount(uid);
			});
		});
	};

	Topics.markCategoryUnreadForAll = function(tid, callback) {
		Topics.getTopicField(tid, 'cid', function(err, cid) {
			if(err) {
				return callback(err);
			}

			categories.markAsUnreadForAll(cid, callback);
		});
	};

	Topics.hasReadTopics = function(tids, uid, callback) {
		if(!parseInt(uid, 10)) {
			return callback(null, tids.map(function() {
				return false;
			}));
		}

		var sets = [];

		for (var i = 0, ii = tids.length; i < ii; i++) {
			sets.push('tid:' + tids[i] + ':read_by_uid');
		}

		db.isMemberOfSets(sets, uid, callback);
	};

	Topics.hasReadTopic = function(tid, uid, callback) {
		if(!parseInt(uid, 10)) {
			return callback(null, false);
		}

		db.isSetMember('tid:' + tid + ':read_by_uid', uid, callback);
	};


};
