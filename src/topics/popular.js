
'use strict';

var async = require('async'),
	db = require('./../database');


module.exports = function(Topics) {

	Topics.getPopular = function(term, uid, callback) {
		var terms = {
			daily: 'day',
			weekly: 'week',
			monthly: 'month',
			yearly: 'year'
		};

		var since = terms[term] || 'day';

		Topics.getLatestTids(0, -1, since, function(err, tids) {
			if (err) {
				return callback(err);
			}

			getTopics(tids, uid, callback);
		});
	};

	function getTopics(tids, uid, callback) {
		var keys = tids.map(function(tid) {
			return 'topic:' + tid;
		});

		db.getObjectsFields(keys, ['tid', 'postcount'], function(err, topics) {
			topics.sort(function(a, b) {
				return parseInt(b.postcount, 10) - parseInt(a.postcount, 10);
			});

			topics = topics.slice(0, 20).map(function(topic) {
				return topic.tid;
			});

			Topics.getTopicsByTids(topics, uid, callback);
		});
	}
};
