
'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var user = require('../user');
var posts = require('../posts');
var notifications = require('../notifications');
var categories = require('../categories');
var privileges = require('../privileges');
var meta = require('../meta');
var utils = require('../utils');
var plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.getTotalUnread = function (uid, filter, callback) {
		if (!callback) {
			callback = filter;
			filter = '';
		}
		Topics.getUnreadTids({ cid: 0, uid: uid, count: true }, function (err, counts) {
			callback(err, counts && counts[filter]);
		});
	};

	Topics.getUnreadTopics = function (params, callback) {
		var unreadTopics = {
			showSelect: true,
			nextStart: 0,
			topics: [],
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

				tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);

				Topics.getTopicsByTids(tids, params.uid, next);
			},
			function (topicData, next) {
				if (!topicData.length) {
					return next(null, unreadTopics);
				}

				unreadTopics.topics = topicData;
				unreadTopics.nextStart = params.stop + 1;
				next(null, unreadTopics);
			},
		], callback);
	};

	Topics.unreadCutoff = function () {
		var cutoff = parseInt(meta.config.unreadCutoff, 10) || 2;
		return Date.now() - (cutoff * 86400000);
	};

	Topics.getUnreadTids = function (params, callback) {
		var uid = parseInt(params.uid, 10);
		var counts = {
			'': 0,
			new: 0,
			watched: 0,
			unreplied: 0,
		};
		if (uid <= 0) {
			return callback(null, params.count ? counts : []);
		}

		params.filter = params.filter || '';

		var cutoff = params.cutoff || Topics.unreadCutoff();

		if (params.cid && !Array.isArray(params.cid)) {
			params.cid = [params.cid];
		}

		async.waterfall([
			function (next) {
				async.parallel({
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
					},
				}, next);
			},
			function (results, next) {
				if (results.recentTids && !results.recentTids.length && !results.tids_unread.length) {
					return callback(null, params.count ? counts : []);
				}

				filterTopics(params, results, next);
			},
			function (data, next) {
				plugins.fireHook('filter:topics.getUnreadTids', {
					uid: uid,
					tids: data.tids,
					counts: data.counts,
					tidsByFilter: data.tidsByFilter,
					cid: params.cid,
					filter: params.filter,
				}, next);
			},
			function (results, next) {
				next(null, params.count ? results.counts : results.tids);
			},
		], callback);
	};

	function filterTopics(params, results, callback) {
		const counts = {
			'': 0,
			new: 0,
			watched: 0,
			unreplied: 0,
		};

		const tidsByFilter = {
			'': [],
			new: [],
			watched: [],
			unreplied: [],
		};

		var userRead = {};
		results.userScores.forEach(function (userItem) {
			userRead[userItem.value] = userItem.score;
		});

		results.recentTids = results.recentTids.concat(results.tids_unread);
		results.recentTids.sort(function (a, b) {
			return b.score - a.score;
		});

		var tids = results.recentTids.filter(function (recentTopic) {
			if (results.ignoredTids.includes(String(recentTopic.value))) {
				return false;
			}
			return !userRead[recentTopic.value] || recentTopic.score > userRead[recentTopic.value];
		});

		tids = _.uniq(tids.map(topic => topic.value));

		var cid = params.cid;
		var uid = params.uid;
		var cids;
		var topicData;
		var blockedUids;

		tids = tids.slice(0, 200);

		if (!tids.length) {
			return callback(null, { counts: counts, tids: tids });
		}

		async.waterfall([
			function (next) {
				user.blocks.list(uid, next);
			},
			function (_blockedUids, next) {
				blockedUids = _blockedUids;
				filterTidsThatHaveBlockedPosts({
					uid: uid,
					tids: tids,
					blockedUids: blockedUids,
					recentTids: results.recentTids,
				}, next);
			},
			function (_tids, next) {
				tids = _tids;
				Topics.getTopicsFields(tids, ['tid', 'cid', 'uid', 'postcount'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				cids = _.uniq(topicData.map(topic => topic.cid)).filter(Boolean);

				async.parallel({
					isTopicsFollowed: function (next) {
						db.sortedSetScores('uid:' + uid + ':followed_tids', tids, next);
					},
					ignoredCids: function (next) {
						user.getIgnoredCategories(uid, next);
					},
					readableCids: function (next) {
						privileges.categories.filterCids('read', cids, uid, next);
					},
				}, next);
			},
			function (results, next) {
				cid = cid && cid.map(String);
				results.readableCids = results.readableCids.map(String);

				topicData.forEach(function (topic, index) {
					function cidMatch(topicCid) {
						return (!cid || (cid.length && cid.includes(String(topicCid)))) && results.readableCids.includes(String(topicCid));
					}

					if (topic && topic.cid && cidMatch(topic.cid) && !blockedUids.includes(parseInt(topic.uid, 10))) {
						topic.tid = parseInt(topic.tid, 10);
						if ((results.isTopicsFollowed[index] || !results.ignoredCids.includes(String(topic.cid)))) {
							counts[''] += 1;
							tidsByFilter[''].push(topic.tid);
						}

						if (results.isTopicsFollowed[index]) {
							counts.watched += 1;
							tidsByFilter.watched.push(topic.tid);
						}

						if (parseInt(topic.postcount, 10) <= 1) {
							counts.unreplied += 1;
							tidsByFilter.unreplied.push(topic.tid);
						}

						if (!userRead[topic.tid]) {
							counts.new += 1;
							tidsByFilter.new.push(topic.tid);
						}
					}
				});

				next(null, {
					counts: counts,
					tids: tidsByFilter[params.filter],
					tidsByFilter: tidsByFilter,
				});
			},
		], callback);
	}

	function filterTidsThatHaveBlockedPosts(params, callback) {
		if (!params.blockedUids.length) {
			return setImmediate(callback, null, params.tids);
		}
		const topicScores = _.mapValues(_.keyBy(params.recentTids, 'value'), 'score');

		db.sortedSetScores('uid:' + params.uid + ':tids_read', params.tids, function (err, results) {
			if (err) {
				return callback(err);
			}
			const userScores = _.zipObject(params.tids, results);

			async.filter(params.tids, function (tid, next) {
				doesTidHaveUnblockedUnreadPosts(tid, {
					blockedUids: params.blockedUids,
					topicTimestamp: topicScores[tid],
					userLastReadTimestamp: userScores[tid],
				}, next);
			}, callback);
		});
	}

	function doesTidHaveUnblockedUnreadPosts(tid, params, callback) {
		var userLastReadTimestamp = params.userLastReadTimestamp;
		if (!userLastReadTimestamp) {
			return setImmediate(callback, null, true);
		}
		var start = 0;
		var count = 3;
		var done = false;
		var hasUnblockedUnread = params.topicTimestamp > userLastReadTimestamp;

		async.whilst(function () {
			return !done;
		}, function (_next) {
			async.waterfall([
				function (next) {
					db.getSortedSetRangeByScore('tid:' + tid + ':posts', start, count, userLastReadTimestamp, '+inf', next);
				},
				function (pidsSinceLastVisit, next) {
					if (!pidsSinceLastVisit.length) {
						done = true;
						return _next();
					}

					posts.getPostsFields(pidsSinceLastVisit, ['pid', 'uid'], next);
				},
				function (postData, next) {
					postData = postData.filter(function (post) {
						return !params.blockedUids.includes(parseInt(post.uid, 10));
					});

					done = postData.length > 0;
					hasUnblockedUnread = postData.length > 0;
					start += count;
					next();
				},
			], _next);
		}, function (err) {
			callback(err, hasUnblockedUnread);
		});
	}

	Topics.pushUnreadCount = function (uid, callback) {
		callback = callback || function () {};

		if (!uid || parseInt(uid, 10) === 0) {
			return setImmediate(callback);
		}

		async.waterfall([
			function (next) {
				Topics.getUnreadTids({ uid: uid, count: true }, next);
			},
			function (results, next) {
				require('../socket.io').in('uid_' + uid).emit('event:unread.updateCount', {
					unreadTopicCount: results[''],
					unreadNewTopicCount: results.new,
					unreadWatchedTopicCount: results.watched,
					unreadUnrepliedTopicCount: results.unreplied,
				});
				setImmediate(next);
			},
		], callback);
	};

	Topics.markAsUnreadForAll = function (tid, callback) {
		Topics.markCategoryUnreadForAll(tid, callback);
	};

	Topics.markAsRead = function (tids, uid, callback) {
		callback = callback || function () {};
		if (!Array.isArray(tids) || !tids.length) {
			return setImmediate(callback, null, false);
		}

		tids = _.uniq(tids).filter(function (tid) {
			return tid && utils.isNumber(tid);
		});

		if (!tids.length) {
			return setImmediate(callback, null, false);
		}

		async.waterfall([
			function (next) {
				async.parallel({
					topicScores: async.apply(db.sortedSetScores, 'topics:recent', tids),
					userScores: async.apply(db.sortedSetScores, 'uid:' + uid + ':tids_read', tids),
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
					topicData: async.apply(Topics.getTopicsFields, tids, ['cid']),
				}, next);
			},
			function (results, next) {
				var cids = results.topicData.map(function (topic) {
					return topic && topic.cid;
				}).filter(Boolean);

				cids = _.uniq(cids);

				categories.markAsRead(cids, uid, next);
			},
			function (next) {
				plugins.fireHook('action:topics.markAsRead', { uid: uid, tids: tids });
				next(null, true);
			},
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
			},
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
			},
		], callback);
	};

	Topics.markCategoryUnreadForAll = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				categories.markAsUnreadForAll(cid, next);
			},
		], callback);
	};

	Topics.hasReadTopics = function (tids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, tids.map(function () {
				return false;
			}));
		}

		async.waterfall([
			function (next) {
				async.parallel({
					topicScores: function (next) {
						db.sortedSetScores('topics:recent', tids, next);
					},
					userScores: function (next) {
						db.sortedSetScores('uid:' + uid + ':tids_read', tids, next);
					},
					tids_unread: function (next) {
						db.sortedSetScores('uid:' + uid + ':tids_unread', tids, next);
					},
					blockedUids: function (next) {
						user.blocks.list(uid, next);
					},
				}, next);
			},
			function (results, next) {
				var cutoff = Topics.unreadCutoff();
				var result = tids.map(function (tid, index) {
					var read = !results.tids_unread[index] &&
						(results.topicScores[index] < cutoff ||
						!!(results.userScores[index] && results.userScores[index] >= results.topicScores[index]));
					return { tid: tid, read: read, index: index };
				});

				async.map(result, function (data, next) {
					if (data.read) {
						return next(null, true);
					}
					doesTidHaveUnblockedUnreadPosts(data.tid, {
						topicTimestamp: results.topicScores[data.index],
						userLastReadTimestamp: results.userScores[data.index],
						blockedUids: results.blockedUids,
					}, function (err, hasUnblockedUnread) {
						if (err) {
							return next(err);
						}
						if (!hasUnblockedUnread) {
							data.read = true;
						}
						next(null, data.read);
					});
				}, next);
			},
		], callback);
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
			},
		], callback);
	};

	Topics.filterNewTids = function (tids, uid, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetScores('uid:' + uid + ':tids_read', tids, next);
			},
			function (scores, next) {
				tids = tids.filter(function (tid, index) {
					return tid && !scores[index];
				});
				next(null, tids);
			},
		], callback);
	};

	Topics.filterUnrepliedTids = function (tids, callback) {
		async.waterfall([
			function (next) {
				db.sortedSetScores('topics:posts', tids, next);
			},
			function (scores, next) {
				tids = tids.filter(function (tid, index) {
					return tid && scores[index] <= 1;
				});
				next(null, tids);
			},
		], callback);
	};
};
