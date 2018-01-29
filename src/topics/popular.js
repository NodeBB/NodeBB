
'use strict';

var async = require('async');

var db = require('../database');
var privileges = require('../privileges');

module.exports = function (Topics) {
	Topics.getPopular = function (term, uid, count, callback) {
		count = parseInt(count, 10) || 20;
		async.waterfall([
			function (next) {
				Topics.getPopularTopics(term, uid, 0, count - 1, next);
			},
			function (data, next) {
				next(null, data.topics);
			},
		], callback);
	};

	Topics.getPopularTopics = function (term, uid, start, stop, callback) {
		var popularTopics = {
			nextStart: 0,
			topicCount: 0,
			topics: [],
		};
		async.waterfall([
			function (next) {
				if (term === 'alltime') {
					db.getSortedSetRevRange('topics:posts', 0, 199, next);
				} else {
					Topics.getLatestTidsFromSet('topics:tid', 0, -1, term, next);
				}
			},
			function (tids, next) {
				popularTopics.topicCount = tids.length;
				getTopics(tids, uid, start, stop, next);
			},
			function (topics, next) {
				popularTopics.topics = topics;
				popularTopics.nextStart = stop + 1;
				next(null, popularTopics);
			},
		], callback);
	};

	function getTopics(tids, uid, start, stop, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicsFields(tids, ['tid', 'postcount', 'deleted'], next);
			},
			function (topics, next) {
				tids = topics.filter(function (topic) {
					return topic && parseInt(topic.deleted, 10) !== 1;
				}).sort(sortPopular).slice(start, stop !== -1 ? stop - 1 : undefined).map(function (topic) {
					return topic.tid;
				});
				privileges.topics.filterTids('read', tids, uid, next);
			},
			function (tids, next) {
				Topics.getTopicsByTids(tids, uid, next);
			},
		], callback);
	}

	function sortPopular(a, b) {
		if (parseInt(a.postcount, 10) !== parseInt(b.postcount, 10)) {
			return b.postcount - a.postcount;
		}
		return parseInt(b.viewcount, 10) - parseInt(a.viewcount, 10);
	}
};
