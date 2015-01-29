'use strict';

var async = require('async'),
	posts = require('./posts'),
	topics = require('./topics'),
	user = require('./user'),
	plugins = require('./plugins'),
	privileges = require('./privileges');

var search = {};

module.exports = search;

search.search = function(data, callback) {
	function done(err, data) {
		if (err) {
			return callback(err);
		}

		result.search_query = query;
		result[searchIn] = data;
		result.matchCount = data.length;
		result.hidePostedBy = searchIn !== 'posts';
		result.time = (process.elapsedTimeSince(start) / 1000).toFixed(2);
		callback(null, result);
	}

	var start = process.hrtime();

	var query = data.query;
	var searchIn = data.searchIn || 'posts';
	var uid = data.uid || 0;

	var result = {
		posts: [],
		users: [],
		tags: []
	};

	if (searchIn === 'posts') {
		searchInPosts(query, data.postedBy, uid, done);
	} else if (searchIn === 'users') {
		searchInUsers(query, uid, done);
	} else if (searchIn === 'tags') {
		searchInTags(query, done);
	} else {
		callback(new Error('[[error:unknown-search-filter]]'));
	}
};

function searchInPosts(query, postedBy, uid, callback) {
	async.parallel({
		pids: function(next) {
			searchQuery('post', query, next);
		},
		tids: function(next) {
			searchQuery('topic', query, next);
		},
		postedByUid: function(next) {
			if (postedBy) {
				user.getUidByUsername(postedBy, next);
			} else {
				next(null, 0);
			}
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
			},
			function(posts, next) {
				if (postedBy) {
					posts = posts.filter(function(post) {
						return post && parseInt(post.uid, 10) === parseInt(results.postedByUid, 10);
					});
				}
				next(null, posts);
			}
		], callback);
	});
}

function searchInUsers(query, uid, callback) {
	user.search({query: query, uid: uid}, function(err, results) {
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

