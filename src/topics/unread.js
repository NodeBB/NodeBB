
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

		Topics.getUnreadTids(uid, start, stop, function(err, tids) {
			if (err) {
				return callback(err);
			}

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
		});
	};

	Topics.getUnreadTids = function(uid, start, stop, callback) {
		uid = parseInt(uid, 10);
		if (uid === 0) {
			return callback(null, []);
		}

		var yesterday = Date.now() - 86400000;

		async.parallel({
			ignoredCids: function(next) {
				user.getIgnoredCategories(uid, next);
			},
			recentTids: function(next) {
				db.getSortedSetRevRangeByScoreWithScores('topics:recent', 0, -1, Infinity, yesterday, next);
			},
			userScores: function(next) {
				db.getSortedSetRevRangeByScoreWithScores('uid:' + uid + ':tids_read', 0, -1, Infinity, yesterday, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (results.recentTids && !results.recentTids.length) {
				return callback(null, []);
			}

			var userRead = {};
			results.userScores.forEach(function(userItem) {
				userRead[userItem.value] = userItem.score;
			});


			var tids = results.recentTids.filter(function(recentTopic, index) {
				return !userRead[recentTopic.value] || recentTopic.score > userRead[recentTopic.value];
			}).map(function(topic) {
				return topic.value;
			});

			filterTopics(uid, tids, results.ignoredCids, function(err, tids) {
				if (err) {
					return callback(err);
				}

				if (stop === -1) {
					tids = tids.slice(start);
				} else {
					tids = tids.slice(start, stop + 1);
				}

				callback(err, tids);
			});
		});
	};

	function filterTopics(uid, tids, ignoredCids, callback) {
		if (!Array.isArray(ignoredCids) || !tids.length) {
			return callback(null, tids);
		}

		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});

		db.getObjectsFields(keys, ['tid', 'cid'], function(err, topics) {
			if (err) {
				return callback(err);
			}

			var topicCids = topics.filter(function(topic) {
				return topic && topic.cid;
			}).map(function(topic) {
				return topic.cid.toString();
			});

			topicCids = topicCids.filter(function(cid) {
				return ignoredCids.indexOf(cid) === -1;
			});

			privileges.categories.filterCids('read', topicCids, uid, function(err, readableCids) {
				if (err) {
					return callback(err);
				}

				topics = topics.filter(function(topic) {
					return topic.cid && readableCids.indexOf(topic.cid.toString()) !== -1;
				}).map(function(topic) {
					return topic.tid;
				});

				callback(null, topics);
			});
		});
	}

	Topics.pushUnreadCount = function(uid, callback) {
		callback = callback || function() {};

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
		Topics.markCategoryUnreadForAll(tid, callback);
	};

	Topics.markAsRead = function(tids, uid, callback) {
		callback = callback || function() {};
		if (!Array.isArray(tids) || !tids.length) {
			return callback();
		}
		tids = tids.filter(Boolean);

		var now = Date.now();
		var scores = tids.map(function(tid) {
			return now;
		});

		async.parallel({
			markRead: function(next) {
				db.sortedSetAdd('uid:' + uid + ':tids_read', scores, tids, next);
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
		if (!tid) {
			return;
		}
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

		async.parallel({
			recentScores: function(next) {
				db.sortedSetScores('topics:recent', tids, next);
			},
			userScores: function(next) {
				db.sortedSetScores('uid:' + uid + ':tids_read', tids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			var result = tids.map(function(tid, index) {
				return !!(results.userScores[index] && results.userScores[index] >= results.recentScores[index]);
			});

			callback(null, result);
		});
	};

	Topics.hasReadTopic = function(tid, uid, callback) {
		Topics.hasReadTopics([tid], uid, function(err, hasRead) {
			callback(err, Array.isArray(hasRead) && hasRead.length ? hasRead[0] : false);
		});
	};


};
