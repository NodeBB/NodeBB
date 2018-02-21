
'use strict';

var async = require('async');
var privileges = require('../privileges');

module.exports = function (Topics) {
	Topics.getPopular = function (term, uid, count, callback) {
		count = parseInt(count, 10) || 20;

		if (term === 'alltime') {
			return getAllTimePopular(uid, count, callback);
		}

		async.waterfall([
			function (next) {
				Topics.getLatestTidsFromSet('topics:tid', 0, -1, term, next);
			},
			function (tids, next) {
				getTopics(tids, uid, count, next);
			},
		], callback);
	};

	function getAllTimePopular(uid, count, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicsFromSet('topics:posts', uid, 0, count - 1, next);
			},
			function (data, next) {
				data.topics.sort(sortPopular);
				next(null, data.topics);
			},
		], callback);
	}

	function getTopics(tids, uid, count, callback) {
		async.waterfall([
			function (next) {
				Topics.getTopicsFields(tids, ['tid', 'postcount', 'deleted'], next);
			},
			function (topics, next) {
				tids = topics.filter(function (topic) {
					return topic && parseInt(topic.deleted, 10) !== 1;
				}).sort(sortPopular).slice(0, count).map(function (topic) {
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
