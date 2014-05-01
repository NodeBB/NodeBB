

'use strict';

var db = require('./../database');

module.exports = function(Topics) {

	Topics.getLatestTopics = function(uid, start, end, term, callback) {
		Topics.getLatestTids(start, end, term, function(err, tids) {
			if(err) {
				return callback(err);
			}

			Topics.getTopics('topics:recent', uid, tids, callback);
		});
	};

	Topics.getLatestTids = function(start, end, term, callback) {
		var terms = {
			day: 86400000,
			week: 604800000,
			month: 2592000000
		};

		var since = terms.day;
		if(terms[term]) {
			since = terms[term];
		}

		var count = parseInt(end, 10) === -1 ? end : end - start + 1;

		db.getSortedSetRevRangeByScore('topics:recent', start, count, Infinity, Date.now() - since, callback);
	};

};
