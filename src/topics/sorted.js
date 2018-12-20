
'use strict';

const async = require('async');
const _ = require('lodash');

const db = require('../database');
const privileges = require('../privileges');
const user = require('../user');
const categories = require('../categories');
const meta = require('../meta');
const plugins = require('../plugins');

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
					if (params.cids) {
						getCidTids(params.cids, params.sort, next);
					} else {
						db.getSortedSetRevRange('topics:' + params.sort, 0, 199, next);
					}
				} else {
					Topics.getLatestTidsFromSet('topics:tid', 0, -1, params.term, next);
				}
			},
			function (tids, next) {
				if (params.term !== 'alltime' || (params.cids && params.sort !== 'recent')) {
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

	function getCidTids(cids, sort, callback) {
		const sets = [];
		const pinnedSets = [];
		cids.forEach(function (cid) {
			if (sort === 'recent') {
				sets.push('cid:' + cid + ':tids:lastposttime');
				return;
			}
			sets.push('cid:' + cid + ':tids' + (sort ? ':' + sort : ''));
			pinnedSets.push('cid:' + cid + ':tids:pinned');
		});
		async.waterfall([
			function (next) {
				async.parallel({
					tids: async.apply(db.getSortedSetRevRange, sets, 0, 199),
					pinnedTids: async.apply(db.getSortedSetRevRange, pinnedSets, 0, -1),
				}, next);
			},
			function (results, next) {
				next(null, results.pinnedTids.concat(results.tids));
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

		let topicData;
		let topicCids;
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
				Topics.getTopicsFields(tids, ['uid', 'tid', 'cid'], next);
			},
			function (_topicData, next) {
				topicData = _topicData;
				topicCids = _.uniq(topicData.map(topic => topic.cid)).filter(Boolean);

				async.parallel({
					ignoredCids: function (next) {
						if (filter === 'watched' || meta.config.disableRecentCategoryFilter) {
							return next(null, []);
						}
						categories.isIgnored(topicCids, uid, next);
					},
					filtered: async.apply(user.blocks.filter, uid, topicData),
				}, next);
			},
			function (results, next) {
				const isCidIgnored = _.zipObject(topicCids, results.ignoredCids);
				topicData = results.filtered;

				const cids = params.cids && params.cids.map(String);
				tids = topicData.filter(function (topic) {
					return topic && topic.cid && !isCidIgnored[topic.cid] && (!cids || (cids.length && cids.includes(topic.cid.toString())));
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
