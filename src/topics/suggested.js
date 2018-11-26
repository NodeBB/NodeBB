
'use strict';

var async = require('async');
var _ = require('lodash');

const db = require('../database');
const user = require('../user');
var privileges = require('../privileges');
var search = require('../search');

module.exports = function (Topics) {
	Topics.getSuggestedTopics = function (tid, uid, start, stop, callback) {
		var tids;
		tid = parseInt(tid, 10);
		async.waterfall([
			function (next) {
				async.parallel({
					tagTids: function (next) {
						getTidsWithSameTags(tid, next);
					},
					searchTids: function (next) {
						getSearchTids(tid, uid, next);
					},
				}, next);
			},
			function (results, next) {
				tids = results.tagTids.concat(results.searchTids);
				tids = tids.filter(_tid => _tid !== tid);
				tids = _.shuffle(_.uniq(tids));

				if (stop !== -1 && tids.length < stop - start + 1) {
					getCategoryTids(tid, next);
				} else {
					next(null, []);
				}
			},
			function (categoryTids, next) {
				tids = _.uniq(tids.concat(categoryTids)).slice(start, stop !== -1 ? stop + 1 : undefined);
				privileges.topics.filterTids('read', tids, uid, next);
			},
			function (tids, next) {
				Topics.getTopicsByTids(tids, uid, next);
			},
			function (topics, next) {
				topics = topics.filter(topic => topic && !topic.deleted && topic.tid !== tid);
				user.blocks.filter(uid, topics, next);
			},
		], callback);
	};

	function getTidsWithSameTags(tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicTags(tid, next);
			},
			function (tags, next) {
				db.getSortedSetRevRange(tags.map(tag => 'tag:' + tag + ':topics'), 0, -1, next);
			},
			function (tids, next) {
				next(null, _.uniq(tids).map(Number));
			},
		], callback);
	}

	function getSearchTids(tid, uid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicFields(tid, ['title', 'cid'], next);
			},
			function (topicData, next) {
				search.search({
					query: topicData.title,
					searchIn: 'titles',
					matchWords: 'any',
					categories: [topicData.cid],
					uid: uid,
					returnIds: true,
				}, next);
			},
			function (data, next) {
				next(null, _.shuffle(data.tids).slice(0, 20).map(Number));
			},
		], callback);
	}

	function getCategoryTids(tid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				db.getSortedSetRevRange('cid:' + cid + ':tids:lastposttime', 0, 9, next);
			},
			function (tids, next) {
				tids = tids.map(Number).filter(_tid => _tid !== tid);
				next(null, _.shuffle(tids));
			},
		], callback);
	}
};
