'use strict';

var async = require('async'),
	posts = require('./posts'),
	topics = require('./topics'),
	plugins = require('./plugins'),
	privileges = require('./privileges');

var search = {};

module.exports = search;

search.search = function(term, uid, callback) {
	var start = process.hrtime();

	async.parallel({
		pids: function(next) {
			searchTerm('post', term, next);
		},
		tids: function(next) {
			searchTerm('topic', term, next);
		}
	}, function (err, results) {
		if (err) {
			return callback(err);
		}

		if (!results || (!results.pids.length && !results.tids.length)) {
			return callback(null, {
				time: (process.elapsedTimeSince(start) / 1000).toFixed(2),
				search_query: term,
				results: [],
				matchCount: 0
			});
		}

		getMainPids(results.tids, function(err, mainPids) {
			if (err) {
				return callback(err);
			}

			results.pids.forEach(function(pid) {
				if (mainPids.indexOf(pid) === -1) {
					mainPids.push(pid);
				}
			});

			privileges.posts.filter('read', mainPids, uid, function(err, pids) {
				if (err) {
					return callback(err);
				}

				posts.getPostSummaryByPids(pids, uid, {stripTags: true, parse: false}, function(err, posts) {
					if (err) {
						return callback(err);
					}

					callback(null, {
						time: (process.elapsedTimeSince(start) / 1000).toFixed(2),
						search_query: term,
						results: posts,
						matchCount: posts.length
					});
				});
			});
		});
	});
};


function getMainPids(tids, callback) {
	topics.getTopicsFields(tids, ['mainPid'], function(err, topics) {
		if (err) {
			return callback(err);
		}
		topics = topics.map(function(topic) {
			return topic && topic.mainPid;
		}).filter(Boolean);
		callback(null, topics);
	});
}

function searchTerm(index, term, callback) {
	plugins.fireHook('filter:search.query', {
		index: index,
		query: term
	}, callback);
}

