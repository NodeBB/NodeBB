

'use strict';

var async = require('async');
var winston = require('winston');

var db = require('../database');
var plugins = require('../plugins');
var privileges = require('../privileges');
var user = require('../user');
var meta = require('../meta');
var posts = require('../posts');

module.exports = function (Topics) {
	var terms = {
		day: 86400000,
		week: 604800000,
		month: 2592000000,
		year: 31104000000,
	};

	Topics.getSortedTopics = function (params, callback) {
		var data = {
			nextStart: 0,
			topicCount: 0,
			topics: [],
		};

		params.term = params.term || 'alltime';
		params.sort = params.sort || 'recent';
		if (params.hasOwnProperty('cids') && params.cids && !Array.isArray(params.cids)) {
			params.cids = [params.cids];
		}

		async.waterfall([
			function (next) {
				getTids(params, next);
			},
			function (tids, next) {
				data.topicCount = tids.length;
				getTopics(tids, params, next);
			},
			function (topicData, next) {
				data.topics = topicData;
				data.nextStart = params.stop + 1;
				next(null, data);
			},
		], callback);
	};

	function getTids(params, callback) {
		async.waterfall([
			function (next) {
				if (params.term === 'alltime') {
					var key = 'topics:' + params.sort;
					if (params.cids) {
						key = params.cids.map(function (cid) {
							if (params.sort === 'recent') {
								return 'cid:' + cid + ':tids:lastposttime';
							} else if (params.sort === 'votes') {
								return 'cid:' + cid + ':tids:votes';
							} else if (params.sort === 'posts') {
								return 'cid:' + cid + ':tids:posts';
							}
							return 'cid:' + cid + ':tids';
						});
					}

					db.getSortedSetRevRange(key, 0, 199, next);
				} else {
					Topics.getLatestTidsFromSet('topics:tid', 0, -1, params.term, next);
				}
			},
			function (tids, next) {
				if (params.term !== 'alltime') {
					sortTids(tids, params, next);
				} else {
					next(null, tids);
				}
			},
			function (tids, next) {
				filterTids(tids, params.uid, params.filter, params.cids, next);
			},
		], callback);
	}

	function sortTids(tids, params, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicsFields(tids, ['tid', 'lastposttime', 'upvotes', 'downvotes', 'postcount'], next);
			},
			function (topicData, next) {
				var sortFn = sortRecent;
				if (params.sort === 'posts') {
					sortFn = sortPopular;
				} else if (params.sort === 'votes') {
					sortFn = sortVotes;
				}
				tids = topicData.sort(sortFn).map(function (topic) {
					return topic && topic.tid;
				});
				next(null, tids);
			},
		], callback);
	}

	function sortRecent(a, b) {
		return b.lastposttime - a.lastposttime;
	}

	function sortVotes(a, b) {
		if (parseInt(a.votes, 10) !== parseInt(b.votes, 10)) {
			return b.votes - a.votes;
		}
		return parseInt(b.postcount, 10) - parseInt(a.postcount, 10);
	}

	function sortPopular(a, b) {
		if (parseInt(a.postcount, 10) !== parseInt(b.postcount, 10)) {
			return b.postcount - a.postcount;
		}
		return parseInt(b.viewcount, 10) - parseInt(a.viewcount, 10);
	}

	function getTopics(tids, params, callback) {
		async.waterfall([
			function (next) {
				tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);
				Topics.getTopicsByTids(tids, params.uid, next);
			},
			function (topicData, next) {
				topicData.forEach(function (topicObj, i) {
					topicObj.index = params.start + i;
				});
				next(null, topicData);
			},
		], callback);
	}

	Topics.getRecentTopics = function (cid, uid, start, stop, filter, callback) {
		Topics.getSortedTopics({
			cids: cid,
			uid: uid,
			start: start,
			stop: stop,
			filter: filter,
			sort: 'recent',
		}, callback);
	};

	function filterTids(tids, uid, filter, cids, callback) {
		async.waterfall([
			function (next) {
				if (filter === 'watched') {
					Topics.filterWatchedTids(tids, uid, next);
				} else if (filter === 'new') {
					Topics.filterNewTids(tids, uid, next);
				} else if (filter === 'unreplied') {
					Topics.filterUnrepliedTids(tids, next);
				} else {
					Topics.filterNotIgnoredTids(tids, uid, next);
				}
			},
			function (tids, next) {
				privileges.topics.filterTids('read', tids, uid, next);
			},
			function (tids, next) {
				async.parallel({
					ignoredCids: function (next) {
						if (filter === 'watched' || parseInt(meta.config.disableRecentCategoryFilter, 10) === 1) {
							return next(null, []);
						}
						user.getIgnoredCategories(uid, next);
					},
					topicData: function (next) {
						Topics.getTopicsFields(tids, ['uid', 'tid', 'cid'], next);
					},
				}, next);
			},
			function (results, next) {
				user.blocks.filter(uid, results.topicData, function (err, filtered) {
					if (err) {
						return next(err);
					}

					results.topicData = filtered;
					next(null, results);
				});
			},
			function (results, next) {
				cids = cids && cids.map(String);
				tids = results.topicData.filter(function (topic) {
					if (topic && topic.cid) {
						return !results.ignoredCids.includes(topic.cid.toString()) && (!cids || (cids.length && cids.includes(topic.cid.toString())));
					}
					return false;
				}).map(function (topic) {
					return topic.tid;
				});
				next(null, tids);
			},
		], callback);
	}

	/* not an orphan method, used in widget-essentials */
	Topics.getLatestTopics = function (uid, start, stop, term, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestTidsFromSet('topics:recent', start, stop, term, next);
			},
			function (tids, next) {
				Topics.getTopics(tids, uid, next);
			},
			function (topics, next) {
				next(null, { topics: topics, nextStart: stop + 1 });
			},
		], callback);
	};

	Topics.getLatestTidsFromSet = function (set, start, stop, term, callback) {
		var since = terms.day;
		if (terms[term]) {
			since = terms[term];
		}

		var count = parseInt(stop, 10) === -1 ? stop : stop - start + 1;

		db.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since, callback);
	};

	Topics.updateLastPostTimeFromLastPid = function (tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getLatestUndeletedPid(tid, next);
			},
			function (pid, next) {
				if (!parseInt(pid, 10)) {
					return callback();
				}
				posts.getPostField(pid, 'timestamp', next);
			},
			function (timestamp, next) {
				if (!parseInt(timestamp, 10)) {
					return callback();
				}
				Topics.updateLastPostTime(tid, timestamp, next);
			},
		], callback);
	};

	Topics.updateLastPostTime = function (tid, lastposttime, callback) {
		async.waterfall([
			function (next) {
				Topics.setTopicField(tid, 'lastposttime', lastposttime, next);
			},
			function (next) {
				Topics.getTopicFields(tid, ['cid', 'deleted', 'pinned'], next);
			},
			function (topicData, next) {
				var tasks = [
					async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids:lastposttime', lastposttime, tid),
				];

				if (parseInt(topicData.deleted, 10) !== 1) {
					tasks.push(async.apply(Topics.updateRecent, tid, lastposttime));
				}

				if (parseInt(topicData.pinned, 10) !== 1) {
					tasks.push(async.apply(db.sortedSetAdd, 'cid:' + topicData.cid + ':tids', lastposttime, tid));
				}
				async.series(tasks, next);
			},
		], function (err) {
			callback(err);
		});
	};

	Topics.updateTimestamp = function (tid, lastposttime, callback) {
		winston.warn('[deprecated] Topics.updateTimestamp is deprecated please use Topics.updateLastPostTime');
		Topics.updateLastPostTime(tid, lastposttime, callback);
	};

	Topics.updateRecent = function (tid, timestamp, callback) {
		callback = callback || function () {};

		async.waterfall([
			function (next) {
				if (plugins.hasListeners('filter:topics.updateRecent')) {
					plugins.fireHook('filter:topics.updateRecent', { tid: tid, timestamp: timestamp }, next);
				} else {
					next(null, { tid: tid, timestamp: timestamp });
				}
			},
			function (data, next) {
				if (data && data.tid && data.timestamp) {
					db.sortedSetAdd('topics:recent', data.timestamp, data.tid, next);
				} else {
					next();
				}
			},
		], callback);
	};
};
