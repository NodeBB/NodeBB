
'use strict';

var async = require('async'),
	db = require('../database'),
	privileges = require('../privileges');


module.exports = function(Topics) {

	Topics.getPopular = function(term, uid, count, callback) {
		count = parseInt(count, 10) || 20;
		var terms = {
			daily: 'day',
			weekly: 'week',
			monthly: 'month',
			yearly: 'year'
		};

		if (term === 'alltime') {
			return getAllTimePopular(uid, count, callback);
		}

		var since = terms[term] || 'day';

		async.waterfall([
			function(next) {
				Topics.getLatestTids(0, -1, since, next);
			},
			function(tids, next) {
				getTopics(tids, uid, count, next);
			},
			function(topics, next) {
				var tids = topics.map(function(topic) {
					return topic.tid;
				});

				privileges.topics.filter('read', tids, uid, function(err, tids) {
					if (err) {
						return next(err);
					}

					topics = topics.filter(function(topic) {
						return tids.indexOf(topic.tid) !== -1;
					});

					next(null, topics);
				});
			}
		], callback);
	};

	function getAllTimePopular(uid, count, callback) {
		Topics.getTopicsFromSet(uid, 'topics:posts', 0, count - 1, function(err, data) {
			callback(err, data ? data.topics : null);
		});
	}

	function getTopics(tids, uid, count, callback) {
		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});

		db.getObjectsFields(keys, ['tid', 'postcount'], function(err, topics) {
			if (err) {
				return callback(err);
			}

			topics.sort(function(a, b) {
				return parseInt(b.postcount, 10) - parseInt(a.postcount, 10);
			});

			topics = topics.slice(0, count).map(function(topic) {
				return topic.tid;
			});

			Topics.getTopicsByTids(topics, uid, callback);
		});
	}
};
