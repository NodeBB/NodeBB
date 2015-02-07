'use strict';

var async = require('async'),

	db = require('./database'),
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
		result[searchIn] = data.matches;
		result.matchCount = data.matchCount;
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

		var matchCount = 0;
		if (!results || (!results.pids.length && !results.tids.length)) {
			return callback(null, {matches: [], matchCount: matchCount});
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
				filterAndSort(pids, data, results.searchCategories, next);
			},
			function(pids, next) {
				matchCount = pids.length;
				if (data.page) {
					var start = Math.max(0, (data.page - 1)) * 10;
					pids = pids.slice(start, start + 10);
				}

				posts.getPostSummaryByPids(pids, data.uid, {stripTags: true, parse: false}, next);
			},
			function(posts, next) {
				next(null, {matches: posts, matchCount: matchCount});
			}
		], callback);
	});
}

function filterAndSort(pids, data, searchCategories, callback) {
	var postFields = ['pid', 'tid', 'timestamp'];
	var topicFields = [];

	if (data.postedBy) {
		postFields.push('uid');
	}

	if (searchCategories.length) {
		topicFields.push('cid');
	}

	if (data.replies) {
		topicFields.push('postcount');
	}

	async.parallel({
		posts: function(next) {
			getMatchedPosts(pids, postFields, topicFields, next);
		},
		postedByUid: function(next) {
			if (data.postedBy) {
				user.getUidByUsername(data.postedBy, next);
			} else {
				next();
			}
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}
		if (!results.posts) {
			return callback(null, pids);
		}
		var posts = results.posts.filter(Boolean);

		posts = filterByUser(posts, results.postedByUid);
		posts = filterByCategories(posts, searchCategories);
		posts = filterByPostcount(posts, data.replies, data.repliesFilter);
		posts = filterByTimerange(posts, data.timeRange, data.timeFilter);

		sortPosts(posts, data);

		pids = posts.map(function(post) {
			return post && post.pid;
		});

		callback(null, pids);
	});
}

function getMatchedPosts(pids, postFields, topicFields, callback) {
	var keys = pids.map(function(pid) {
		return 'post:' + pid;
	});
	var posts;
	async.waterfall([
		function(next) {
			db.getObjectsFields(keys, postFields, next);
		},
		function(_posts, next) {
			posts = _posts;
			if (!topicFields.length) {
				return callback(null, posts);
			}
			var topicKeys = posts.map(function(post) {
				return 'topic:' + post.tid;
			});
			db.getObjectsFields(topicKeys, topicFields, next);
		},
		function(topics, next) {
			posts.forEach(function(post, index) {
				post.topic = topics[index];
			});

			next(null, posts);
		}
	], callback);
}

function filterByUser(posts, postedByUid) {
	if (postedByUid) {
		postedByUid = parseInt(postedByUid, 10);
		posts = posts.filter(function(post) {
			return parseInt(post.uid, 10) === postedByUid;
		});
	}
	return posts;
}

function filterByCategories(posts, searchCategories) {
	if (searchCategories.length) {
		posts = posts.filter(function(post) {
			return post.topic && searchCategories.indexOf(post.topic.cid) !== -1;
		});
	}
	return posts;
}

function filterByPostcount(posts, postCount, repliesFilter) {
	postCount = parseInt(postCount, 10);
	if (postCount) {
		if (repliesFilter === 'atleast') {
			posts = posts.filter(function(post) {
				return post.topic && post.topic.postcount >= postCount;
			});
		} else {
			posts = posts.filter(function(post) {
				return post.topic && post.topic.postcount <= postCount;
			});
		}
	}
	return posts;
}

function filterByTimerange(posts, timeRange, timeFilter) {
	timeRange = parseInt(timeRange) * 1000;
	if (timeRange) {
		var time = Date.now() - timeRange;
		if (timeFilter === 'newer') {
			posts = posts.filter(function(post) {
				return post.timestamp >= time;
			});
		} else {
			posts = posts.filter(function(post) {
				return post.timestamp <= time;
			});
		}
	}
	return posts;
}

function sortPosts(posts, data) {
	posts.sort(function(p1, p2) {
		return p2.timestamp - p1.timestamp;
	});
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
		if (err) {
			return callback(err);
		}
		callback(null, {matches: results.users, matchCount: results.matchCount});
	});
}

function searchInTags(query, callback) {
	topics.searchAndLoadTags({query: query}, function(err, tags) {
		if (err) {
			return callback(err);
		}

		callback(null, {matches: tags, matchCount: tags.length});
	});
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

