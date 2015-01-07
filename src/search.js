'use strict';

var async = require('async'),
	posts = require('./posts'),
	topics = require('./topics'),
	user = require('./user'),
	plugins = require('./plugins'),
	privileges = require('./privileges');

var search = {};

module.exports = search;

search.search = function(query, searchIn, uid, callback) {
	function done(err, data) {
		if (err) {
			return callback(err);
		}

		result.search_query = query;
		result[searchIn] = data;
		result.matchCount = data.length;
		result.time = (process.elapsedTimeSince(start) / 1000).toFixed(2);
		callback(null, result);
	}

	var start = process.hrtime();
	searchIn = searchIn || 'posts';

	var result = {
		posts: [],
		users: [],
		tags: []
	};

	if (searchIn === 'posts') {
		searchInPosts(query, uid, done);
	} else if (searchIn === 'users') {
		searchInUsers(query, done);
	} else if (searchIn === 'tags') {
		searchInTags(query, done);
	} else {
		callback(new Error('[[error:unknown-search-filter]]'));
	}
};

function searchInPosts(query, uid, callback) {
	async.parallel({
		pids: function(next) {
			searchQuery('post', query, next);
		},
		tids: function(next) {
			searchQuery('topic', query, next);
		}
	}, function (err, results) {
		if (err) {
			return callback(err);
		}

		if (!results || (!results.pids.length && !results.tids.length)) {
			return callback(null, []);
		}

		async.waterfall([
			function(next) {
				getMainPids(results.tids, next);
			},
			function(mainPids, next) {
				results.pids.forEach(function(pid) {
					if (mainPids.indexOf(pid) === -1) {
						mainPids.push(pid);
					}
				});
				privileges.posts.filter('read', mainPids, uid, next);
			},
			function(pids, next) {
				posts.getPostSummaryByPids(pids, uid, {stripTags: true, parse: false}, next);
			}
		], callback);
	});
}

function searchInUsers(query, callback) {
	user.search({query: query}, function(err, results) {
		callback(err, results ? results.users : null);
	});
}

function searchInTags(query, callback) {
	topics.searchAndLoadTags({query: query}, callback);
}

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

function searchQuery(index, query, callback) {
	plugins.fireHook('filter:search.query', {
		index: index,
		query: query
	}, callback);
}

