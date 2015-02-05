'use strict';

var async = require('async'),
	posts = require('./posts'),
	topics = require('./topics'),
	categories = require('./categories'),
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

	var result = {
		posts: [],
		users: [],
		tags: []
	};

	if (searchIn === 'posts') {
		searchInPosts(query, data, done);
	} else if (searchIn === 'users') {
		searchInUsers(query, done);
	} else if (searchIn === 'tags') {
		searchInTags(query, done);
	} else {
		callback(new Error('[[error:unknown-search-filter]]'));
	}
};

function searchInPosts(query, data, callback) {
	data.uid = data.uid || 0;
	async.parallel({
		pids: function(next) {
			searchQuery('post', query, next);
		},
		tids: function(next) {
			searchQuery('topic', query, next);
		},
		searchCategories: function(next) {
			getSearchCategories(data, next);
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
				privileges.posts.filter('read', mainPids, data.uid, next);
			},
			function(pids, next) {
				posts.getPostSummaryByPids(pids, data.uid, {stripTags: true, parse: false}, next);
			},
			function(posts, next) {
				posts = filterPosts(data, results.searchCategories, posts);
				next(null, posts);
			}
		], callback);
	});
}

function filterPosts(data, searchCategories, posts) {
	var postedBy = data.postedBy;
	var isAtLeast = data.repliesFilter === 'atleast';
	data.replies = parseInt(data.replies, 10);
	if (postedBy || searchCategories.length || data.replies) {
		posts = posts.filter(function(post) {
			return post &&
				(postedBy ? (post.user && post.user.username) === postedBy : true) &&
				(searchCategories.length ? searchCategories.indexOf(post.category.cid) !== -1 : true) &&
				(data.replies ? (isAtLeast ? post.topic.postcount >= data.replies : post.topic.postcount <= data.replies) : true);
		});
	}
	return posts;
}

function getSearchCategories(data, callback) {
	if (!Array.isArray(data.categories) || !data.categories.length || data.categories.indexOf('all') !== -1) {
		return callback(null, []);
	}

	async.parallel({
		watchedCids: function(next) {
			if (data.categories.indexOf('watched') !== -1) {
				user.getWatchedCategories(data.uid, next);
			} else {
				next(null, []);
			}
		},
		childrenCids: function(next) {
			if (data.searchChildren) {
				getChildrenCids(data.categories, data.uid, next);
			} else {
				next(null, []);
			}
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		var cids = results.watchedCids.concat(results.childrenCids).concat(data.categories).filter(function(cid, index, array) {
			return cid && array.indexOf(cid) === index;
		});

		callback(null, cids);
	});
}

function getChildrenCids(cids, uid, callback) {
	categories.getChildren(cids, uid, function(err, childrenCategories) {
		if (err) {
			return callback(err);
		}

		var childrenCids = [];
		childrenCategories.forEach(function(childrens) {
			childrenCids = childrenCids.concat(childrens.map(function(category) {
				return category && category.cid;
			}));
		});

		callback(null, childrenCids);
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

