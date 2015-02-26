
'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
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

		async.waterfall([
			function(next) {
				Topics.getUnreadTids(uid, start, stop, next);
			},
			function(tids, next) {
				if (!tids.length) {
					return next(null, []);
				}
				Topics.getTopicsByTids(tids, uid, next);
			},
			function(topicData, next) {
				if (!Array.isArray(topicData) || !topicData.length) {
					return next(null, unreadTopics);
				}

				unreadTopics.topics = topicData;
				unreadTopics.nextStart = stop + 1;
				next(null, unreadTopics);
			}
		], callback);
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
				db.getSortedSetRevRangeByScoreWithScores('topics:recent', 0, -1, '+inf', yesterday, next);
			},
			userScores: function(next) {
				db.getSortedSetRevRangeByScoreWithScores('uid:' + uid + ':tids_read', 0, -1, '+inf', yesterday, next);
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

			tids = tids.slice(0, 100);

			filterTopics(uid, tids, results.ignoredCids, function(err, tids) {
				if (err) {
					return callback(err);
				}

				if (stop === -1) {
					tids = tids.slice(start);
				} else {
					tids = tids.slice(start, stop + 1);
				}

				callback(null, tids);
			});
		});
	};

	function filterTopics(uid, tids, ignoredCids, callback) {
		if (!Array.isArray(ignoredCids) || !tids.length) {
			return callback(null, tids);
		}

		async.waterfall([
			function(next) {
				privileges.topics.filter('read', tids, uid, next);
			},
			function(tids, next) {
				Topics.getTopicsFields(tids, ['tid', 'cid'], next);
			},
			function(topics, next) {
				tids = topics.filter(function(topic) {
					return topic && topic.cid && ignoredCids.indexOf(topic.cid.toString()) === -1;
				}).map(function(topic) {
					return topic.tid;
				});
				next(null, tids);
			}
		], callback);
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
		if (!tids.length) {
			return callback();
		}

		async.parallel({
			topicScores: function(next) {
				db.sortedSetScores('topics:recent', tids, next);
			},
			userScores: function(next) {
				db.sortedSetScores('uid:' + uid + ':tids_read', tids, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			tids = tids.filter(function(tid, index) {
				return !results.userScores[index] || results.userScores[index] < results.topicScores[index];
			});

			if (!tids.length) {
				return callback();
			}

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
