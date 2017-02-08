
'use strict';

var async = require('async');

var db = require('../database');
var user = require('../user');
var notifications = require('../notifications');
var categories = require('../categories');
var privileges = require('../privileges');
var meta = require('../meta');
var utils = require('../../public/src/utils');

module.exports = function (Topics) {

	Topics.getTotalUnread = function (uid, filter, callback) {
		if (!callback) {
			callback = filter;
			filter = '';
		}
		Topics.getUnreadTids({cid: 0, uid: uid, filter: filter}, function (err, tids) {
			callback(err, Array.isArray(tids) ? tids.length : 0);
		});
	};


	Topics.getUnreadTopics = function (params, callback) {
		var unreadTopics = {
			showSelect: true,
			nextStart : 0,
			topics: []
		};

		async.waterfall([
			function (next) {
				Topics.getUnreadTids(params, next);
			},
			function (tids, next) {
				unreadTopics.topicCount = tids.length;

				if (!tids.length) {
					return next(null, []);
				}

				if (params.stop === -1) {
					tids = tids.slice(params.start);
				} else {
					tids = tids.slice(params.start, params.stop + 1);
				}

				Topics.getTopicsByTids(tids, params.uid, next);
			},
			function (topicData, next) {
				if (!Array.isArray(topicData) || !topicData.length) {
					return next(null, unreadTopics);
				}

				unreadTopics.topics = topicData;
				unreadTopics.nextStart = params.stop + 1;
				next(null, unreadTopics);
			}
		], callback);
	};

	Topics.unreadCutoff = function () {
		return Date.now() - (parseInt(meta.config.unreadCutoff, 10) || 2) * 86400000;
	};

	Topics.getUnreadTids = function (params, callback) {
		var uid = parseInt(params.uid, 10);
		if (uid === 0) {
			return callback(null, []);
		}
		var cutoff = params.cutoff || Topics.unreadCutoff();
		var ignoredCids;

		async.waterfall([
			function (next) {
				async.parallel({
					ignoredCids: function (next) {
						if (params.filter === 'watched') {
							return next(null, []);
						}
						user.getIgnoredCategories(uid, next);
					},
					ignoredTids: function (next) {
						user.getIgnoredTids(uid, 0, -1, next);
					},
					recentTids: function (next) {
						db.getSortedSetRevRangeByScoreWithScores('topics:recent', 0, -1, '+inf', cutoff, next);
					},
					userScores: function (next) {
						db.getSortedSetRevRangeByScoreWithScores('uid:' + uid + ':tids_read', 0, -1, '+inf', cutoff, next);
					},
					tids_unread: function (next) {
						db.getSortedSetRevRangeWithScores('uid:' + uid + ':tids_unread', 0, -1, next);
					}
				}, next);
			},
			function (results, next) {
				if (results.recentTids && !results.recentTids.length && !results.tids_unread.length) {
					return callback(null, []);
				}

				ignoredCids = results.ignoredCids;

				var userRead = {};
				results.userScores.forEach(function (userItem) {
					userRead[userItem.value] = userItem.score;
				});

				results.recentTids = results.recentTids.concat(results.tids_unread);
				results.recentTids.sort(function (a, b) {
					return b.score - a.score;
				});

				var tids = results.recentTids.filter(function (recentTopic) {
					if (results.ignoredTids.indexOf(recentTopic.value.toString()) !== -1) {
						return false;
					}
					switch (params.filter) {
						case 'new':
							return !userRead[recentTopic.value];
						default:
							return !userRead[recentTopic.value] || recentTopic.score > userRead[recentTopic.value];
					}
				}).map(function (topic) {
					return topic.value;
				}).filter(function (tid, index, array) {
					return array.indexOf(tid) === index;
				});

				if (params.filter === 'watched') {
					Topics.filterWatchedTids(tids, uid, next);
				} else {
					next(null, tids);
				}
			},
			function (tids, next) {

				tids = tids.slice(0, 200);

				filterTopics(uid, tids, params.cid, ignoredCids, params.filter, next);
			}
		], callback);
	};


	function filterTopics(uid, tids, cid, ignoredCids, filter, callback) {
		if (!Array.isArray(ignoredCids) || !tids.length) {
			return callback(null, tids);
		}

		async.waterfall([
			function (next) {
				privileges.topics.filterTids('read', tids, uid, next);
			},
			function (tids, next) {
				async.parallel({
					topics: function (next) {
						Topics.getTopicsFields(tids, ['tid', 'cid'], next);
					},
					isTopicsFollowed: function (next) {
						if (filter === 'watched' || filter === 'new') {
							return next(null, []);
						}
						db.sortedSetScores('uid:' + uid + ':followed_tids', tids, next);
					}
				}, next);
			},
			function (results, next) {
				var topics = results.topics;
				tids = topics.filter(function (topic, index) {
					return topic && topic.cid &&
						(!!results.isTopicsFollowed[index] || ignoredCids.indexOf(topic.cid.toString()) === -1) &&
						(!cid || parseInt(cid, 10) === parseInt(topic.cid, 10));
				}).map(function (topic) {
					return topic.tid;
				});
				next(null, tids);
			}
		], callback);
	}

	Topics.pushUnreadCount = function (uid, callback) {
		callback = callback || function () {};

		if (!uid || parseInt(uid, 10) === 0) {
			return callback();
		}
		Topics.getTotalUnread(uid, function (err, count) {
			if (err) {
				return callback(err);
			}

			require('../socket.io').in('uid_' + uid).emit('event:unread.updateCount', count);
			callback();
		});
	};

	Topics.markAsUnreadForAll = function (tid, callback) {
		Topics.markCategoryUnreadForAll(tid, callback);
	};

	Topics.markAsRead = function (tids, uid, callback) {
		callback = callback || function () {};
		if (!Array.isArray(tids) || !tids.length) {
			return callback();
		}

		tids = tids.filter(function (tid, index, array) {
			return tid && utils.isNumber(tid) && array.indexOf(tid) === index;
		});

		if (!tids.length) {
			return callback(null, false);
		}

		async.waterfall([
			function (next) {
				async.parallel({
					topicScores: async.apply(db.sortedSetScores, 'topics:recent', tids),
					userScores: async.apply(db.sortedSetScores, 'uid:' + uid + ':tids_read', tids)
				}, next);
			},
			function (results, next) {
				tids = tids.filter(function (tid, index) {
					return results.topicScores[index] && (!results.userScores[index] || results.userScores[index] < results.topicScores[index]);
				});

				if (!tids.length) {
					return callback(null, false);
				}

				var now = Date.now();
				var scores = tids.map(function () {
					return now;
				});

				async.parallel({
					markRead: async.apply(db.sortedSetAdd, 'uid:' + uid + ':tids_read', scores, tids),
					markUnread: async.apply(db.sortedSetRemove, 'uid:' + uid + ':tids_unread', tids),
					topicData: async.apply(Topics.getTopicsFields, tids, ['cid'])
				}, next);
			},
			function (results, next) {
				var cids = results.topicData.map(function (topic) {
					return topic && topic.cid;
				}).filter(function (topic, index, array) {
					return topic && array.indexOf(topic) === index;
				});

				categories.markAsRead(cids, uid, next);
			},
			function (next) {
				next(null, true);
			}
		], callback);
	};

	Topics.markAllRead = function (uid, callback) {
		async.waterfall([
			function (next) {
				db.getSortedSetRevRangeByScore('topics:recent', 0, -1, '+inf', Topics.unreadCutoff(), next);
			},
			function (tids, next) {
				Topics.markTopicNotificationsRead(tids, uid);
				Topics.markAsRead(tids, uid, next);
			},
			function (markedRead, next) {
				db.delete('uid:' + uid + ':tids_unread', next);
			}
		], callback);
	};

	Topics.markTopicNotificationsRead = function (tids, uid, callback) {
		callback = callback || function () {};
		if (!Array.isArray(tids) || !tids.length) {
			return callback();
		}

		async.waterfall([
			function (next) {
				user.notifications.getUnreadByField(uid, 'tid', tids, next);
			},
			function (nids, next) {
				notifications.markReadMultiple(nids, uid, next);
			},
			function (next) {
				user.notifications.pushCount(uid);
				next();
			}
		], callback);
	};

	Topics.markCategoryUnreadForAll = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				categories.markAsUnreadForAll(cid, next);
			}
		], callback);
	};

	Topics.hasReadTopics = function (tids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function () {
				return false;
			}));
		}

		async.parallel({
			recentScores: function (next) {
				db.sortedSetScores('topics:recent', tids, next);
			},
			userScores: function (next) {
				db.sortedSetScores('uid:' + uid + ':tids_read', tids, next);
			},
			tids_unread: function (next) {
				db.sortedSetScores('uid:' + uid + ':tids_unread', tids, next);
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			var cutoff = Topics.unreadCutoff();
			var result = tids.map(function (tid, index) {
				return !results.tids_unread[index] &&
					(results.recentScores[index] < cutoff ||
					!!(results.userScores[index] && results.userScores[index] >= results.recentScores[index]));
			});

			callback(null, result);
		});
	};

	Topics.hasReadTopic = function (tid, uid, callback) {
		Topics.hasReadTopics([tid], uid, function (err, hasRead) {
			callback(err, Array.isArray(hasRead) && hasRead.length ? hasRead[0] : false);
		});
	};

	Topics.markUnread = function (tid, uid, callback) {
		async.waterfall([
			function (next) {
				Topics.exists(tid, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-topic]]'));
				}
				db.sortedSetRemove('uid:' + uid + ':tids_read', tid, next);
			},
			function (next) {
				db.sortedSetAdd('uid:' + uid + ':tids_unread', Date.now(), tid, next);
			}
		], callback);
	};

	Topics.filterNewTids = function (tids, uid, callback) {
		db.sortedSetScores('uid:' + uid + ':tids_read', tids, function (err, scores) {
			if (err) {
				return callback(err);
			}
			tids = tids.filter(function (tid, index) {
				return tid && !scores[index];
			});
			callback(null, tids);
		});
	};

};
