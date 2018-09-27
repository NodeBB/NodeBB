
'use strict';

var async = require('async');
var _ = require('lodash');

var privileges = require('../privileges');
var search = require('../search');

module.exports = function (Topics) {
	Topics.getSuggestedTopics = function (tid, uid, start, stop, callback) {
		var tids;
		async.waterfall([
			function (next) {
				async.parallel({
					tagTids: function (next) {
						getTidsWithSameTags(tid, uid, next);
					},
					searchTids: function (next) {
						getSearchTids(tid, uid, next);
					},
				}, next);
			},
			function (results, next) {
				tids = results.tagTids.concat(results.searchTids);
				tids = tids.filter(function (_tid) {
					return parseInt(_tid, 10) !== parseInt(tid, 10);
				});
				tids = _.shuffle(_.uniq(tids));

				if (stop !== -1 && tids.length < stop - start + 1) {
					getCategoryTids(tid, uid, next);
				} else {
					next(null, []);
				}
			},
			function (categoryTids, next) {
				tids = _.uniq(tids.concat(categoryTids)).slice(start, stop !== -1 ? stop + 1 : undefined);
				Topics.getTopicsByTids(tids, uid, next);
			},
		], callback);
	};

	function getTidsWithSameTags(tid, uid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicTags(tid, next);
			},
			function (tags, next) {
				async.map(tags, function (tag, next) {
					Topics.getTagTids(tag, 0, -1, next);
				}, next);
			},
			function (data, next) {
				next(null, _.uniq(_.flatten(data)));
			},
			function (tids, next) {
				tids = tids.map(Number);
				privileges.topics.filterTids('read', tids, uid, next);
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
					page: 1,
					itemsPerPage: 20,
				}, next);
			},
			function (data, next) {
				var tids = data.posts.map(function (post) {
					return post && parseInt(post.tid, 10);
				});
				next(null, tids);
			},
		], callback);
	}

	function getCategoryTids(tid, uid, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicField(tid, 'cid', next);
			},
			function (cid, next) {
				Topics.getRecentTopics(cid, uid, 0, 9, '', next);
			},
			function (data, next) {
				var tids = data.topics.filter(function (topic) {
					return topic && !topic.deleted && parseInt(tid, 10) !== parseInt(topic.tid, 10);
				}).map(function (topic) {
					return topic && parseInt(topic.tid, 10);
				});
				next(null, tids);
			},
		], callback);
	}
};
