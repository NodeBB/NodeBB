
'use strict';

var async = require('async');

var db = require('../database');
var privileges = require('../privileges');
var user = require('../user');
var meta = require('../meta');
var plugins = require('../plugins');

module.exports = function (Topics) {
	Topics.getSortedTopics = function (params, callback) {
		var data = {
			nextStart: 0,
			topicCount: 0,
			topics: [],
		};

		params.term = params.term || 'alltime';
		params.sort = params.sort || 'recent';
		params.query = params.query || {};
		if (params.hasOwnProperty('cids') && params.cids && !Array.isArray(params.cids)) {
			params.cids = [params.cids];
		}

		async.waterfall([
			function (next) {
				getTids(params, next);
			},
			function (tids, next) {
				data.topicCount = tids.length;
				data.tids = tids;
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
				filterTids(tids, params, next);
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
				tids = topicData.sort(sortFn).map(topic => topic && topic.tid);
				next(null, tids);
			},
		], callback);
	}

	function sortRecent(a, b) {
		return b.lastposttime - a.lastposttime;
	}

	function sortVotes(a, b) {
		if (a.votes !== b.votes) {
			return b.votes - a.votes;
		}
		return b.postcount - a.postcount;
	}

	function sortPopular(a, b) {
		if (a.postcount !== b.postcount) {
			return b.postcount - a.postcount;
		}
		return b.viewcount - a.viewcount;
	}

	function filterTids(tids, params, callback) {
		const filter = params.filter;
		const uid = params.uid;

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
						if (filter === 'watched' || meta.config.disableRecentCategoryFilter) {
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
				const cids = params.cids && params.cids.map(String);
				tids = results.topicData.filter(function (topic) {
					if (topic && topic.cid) {
						return !results.ignoredCids.includes(topic.cid.toString()) && (!cids || (cids.length && cids.includes(topic.cid.toString())));
					}
					return false;
				}).map(topic => topic.tid);
				plugins.fireHook('filter:topics.filterSortedTids', { tids: tids, params: params }, next);
			},
			function (data, next) {
				next(null, data && data.tids);
			},
		], callback);
	}

	function getTopics(tids, params, callback) {
		async.waterfall([
			function (next) {
				tids = tids.slice(params.start, params.stop !== -1 ? params.stop + 1 : undefined);
				Topics.getTopicsByTids(tids, params.uid, next);
			},
			function (topicData, next) {
				Topics.calculateTopicIndices(topicData, params.start);
				next(null, topicData);
			},
		], callback);
	}

	Topics.calculateTopicIndices = function (topicData, start) {
		topicData.forEach((topic, index) => {
			if (topic) {
				topic.index = start + index;
			}
		});
	};
};
