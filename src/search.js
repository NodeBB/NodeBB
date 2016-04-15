'use strict';

var async = require('async');
var validator = require('validator');

var db = require('./database');
var posts = require('./posts');
var topics = require('./topics');
var categories = require('./categories');
var user = require('./user');
var plugins = require('./plugins');
var privileges = require('./privileges');
var utils = require('../public/src/utils');

var search = {};

module.exports = search;

search.search = function(data, callback) {

	var start = process.hrtime();
	var searchIn = data.searchIn || 'titlesposts';

	async.waterfall([
		function (next) {
			if (searchIn === 'posts' || searchIn === 'titles' || searchIn === 'titlesposts') {
				searchInContent(data, next);
			} else if (searchIn === 'users') {
				user.search(data, next);
			} else if (searchIn === 'tags') {
				topics.searchAndLoadTags(data, next);
			} else {
				next(new Error('[[error:unknown-search-filter]]'));
			}
		},
		function (result, next) {
			result.search_query = validator.escape(data.query || '');
			result.time = (process.elapsedTimeSince(start) / 1000).toFixed(2);
			next(null, result);
		}
	], callback);
};

function searchInContent(data, callback) {
	data.uid = data.uid || 0;
	async.parallel({
		searchCids: function(next) {
			getSearchCids(data, next);
		},
		searchUids: function(next) {
			getSearchUids(data, next);
		}
	}, function(err, results) {
		if (err) {
			return callback(err);
		}

		async.parallel({
			pids: function(next) {
				if (data.searchIn === 'posts' || data.searchIn === 'titlesposts') {
					search.searchQuery('post', data.query, results.searchCids, results.searchUids, next);
				} else {
					next(null, []);
				}
			},
			tids: function(next) {
				if (data.searchIn === 'titles' || data.searchIn === 'titlesposts') {
					search.searchQuery('topic', data.query, results.searchCids, results.searchUids, next);
				} else {
					next(null, []);
				}
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			var matchCount = 0;
			if (!results || (!results.pids.length && !results.tids.length)) {
				return callback(null, {posts: [], matchCount: matchCount, pageCount: 1});
			}

			async.waterfall([
				function(next) {
					topics.getMainPids(results.tids, next);
				},
				function(mainPids, next) {
					results.pids = mainPids.concat(results.pids).map(function(pid) {
						return pid && pid.toString();
					}).filter(function(pid, index, array) {
						return pid && array.indexOf(pid) === index;
					});

					privileges.posts.filter('read', results.pids, data.uid, next);
				},
				function(pids, next) {
					filterAndSort(pids, data, next);
				},
				function(pids, next) {
					matchCount = pids.length;
					if (data.page) {
						var start = Math.max(0, (data.page - 1)) * 10;
						pids = pids.slice(start, start + 10);
					}

					posts.getPostSummaryByPids(pids, data.uid, {}, next);
				},
				function(posts, next) {
					next(null, {posts: posts, matchCount: matchCount, pageCount: Math.max(1, Math.ceil(parseInt(matchCount, 10) / 10))});
				}
			], callback);
		});
	});
}

function filterAndSort(pids, data, callback) {
	getMatchedPosts(pids, data, function(err, posts) {
		if (err) {
			return callback(err);
		}

		if (!Array.isArray(posts) || !posts.length) {
			return callback(null, pids);
		}
		posts = posts.filter(Boolean);

		posts = filterByPostcount(posts, data.replies, data.repliesFilter);
		posts = filterByTimerange(posts, data.timeRange, data.timeFilter);

		sortPosts(posts, data);

		pids = posts.map(function(post) {
			return post && post.pid;
		});

		callback(null, pids);
	});
}

function getMatchedPosts(pids, data, callback) {
	var postFields = ['pid', 'tid', 'timestamp', 'deleted'];
	var topicFields = ['deleted'];
	var categoryFields = [];

	if (data.replies) {
		topicFields.push('postcount');
	}

	if (data.sortBy) {
		if (data.sortBy.startsWith('category')) {
			topicFields.push('cid');
		} else if (data.sortBy.startsWith('topic.')) {
			topicFields.push(data.sortBy.split('.')[1]);
		} else if (data.sortBy.startsWith('user.')) {
			postFields.push('uid');
		} else if (data.sortBy.startsWith('category.')) {
			categoryFields.push(data.sortBy.split('.')[1]);
		} else if (data.sortBy.startsWith('teaser')) {
			topicFields.push('teaserPid');
		}
	}

	var posts;
	async.waterfall([
		function(next) {
			var keys = pids.map(function(pid) {
				return 'post:' + pid;
			});
			db.getObjectsFields(keys, postFields, next);
		},
		function(_posts, next) {
			posts = _posts.filter(function(post) {
				return post && parseInt(post.deleted, 10) !== 1;
			});

			async.parallel({
				users: function(next) {
					if (data.sortBy && data.sortBy.startsWith('user')) {
						var uids = posts.map(function(post) {
							return post.uid;
						});
						user.getUsersFields(uids, ['username'], next);
					} else {
						next();
					}
				},
				topics: function(next) {
					var topics;
					async.waterfall([
						function(next) {
							var topicKeys = posts.map(function(post) {
								return 'topic:' + post.tid;
							});
							db.getObjectsFields(topicKeys, topicFields, next);
						},
						function(_topics, next) {
							topics = _topics;

							async.parallel({
								teasers: function(next) {
									if (topicFields.indexOf('teaserPid') !== -1) {
										var teaserKeys = topics.map(function(topic) {
											return 'post:' + topic.teaserPid;
										});
										db.getObjectsFields(teaserKeys, ['timestamp'], next);
									} else {
										next();
									}
								},
								categories: function(next) {
									if (!categoryFields.length) {
										return next();
									}
									var cids = topics.map(function(topic) {
										return 'category:' + topic.cid;
									});
									db.getObjectsFields(cids, categoryFields, next);
								}
							}, next);
						}
					], function(err, results) {
						if (err) {
							return next(err);
						}

						topics.forEach(function(topic, index) {
							if (topic && results.categories && results.categories[index]) {
								topic.category = results.categories[index];
							}
							if (topic && results.teasers && results.teasers[index]) {
								topic.teaser = results.teasers[index];
							}
						});

						next(null, topics);
					});
				}
			}, next);
		},
		function(results, next) {

			posts.forEach(function(post, index) {
				if (results.topics && results.topics[index]) {
					post.topic = results.topics[index];
					if (results.topics[index].category) {
						post.category = results.topics[index].category;
					}
					if (results.topics[index].teaser) {
						post.teaser = results.topics[index].teaser;
					}
				}

				if (results.users && results.users[index]) {
					post.user = results.users[index];
				}
			});

			posts = posts.filter(function(post) {
				return post && post.topic && parseInt(post.topic.deleted, 10) !== 1;
			});

			next(null, posts);
		}
	], callback);
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
	if (!posts.length) {
		return;
	}
	data.sortBy = data.sortBy || 'timestamp';
	data.sortDirection = data.sortDirection || 'desc';
	var direction = data.sortDirection === 'desc' ? 1 : -1;

	if (data.sortBy === 'timestamp') {
		posts.sort(function(p1, p2) {
			return direction * (p2.timestamp - p1.timestamp);
		});

		return;
	}

	var firstPost = posts[0];
	var fields = data.sortBy.split('.');

	if (!fields || fields.length !== 2 || !firstPost[fields[0]] || !firstPost[fields[0]][fields[1]]) {
		return;
	}

	var isNumeric = utils.isNumber(firstPost[fields[0]][fields[1]]);

	if (isNumeric) {
		posts.sort(function(p1, p2) {
			return direction * (p2[fields[0]][fields[1]] - p1[fields[0]][fields[1]]);
		});
	} else {
		posts.sort(function(p1, p2) {
			if (p1[fields[0]][fields[1]] > p2[fields[0]][fields[1]]) {
				return direction;
			} else if (p1[fields[0]][fields[1]] < p2[fields[0]][fields[1]]) {
				return -direction;
			}
			return 0;
		});
	}
}

function getSearchCids(data, callback) {
	if (!Array.isArray(data.categories) || !data.categories.length) {
		return callback(null, []);
	}

	if (data.categories.indexOf('all') !== -1) {
		async.waterfall([
			function(next) {
				db.getSortedSetRange('categories:cid', 0, -1, next);
			},
			function(cids, next) {
				privileges.categories.filterCids('read', cids, data.uid, next);
			}
		], callback);
		return;
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
		var allCategories = [];

		childrenCategories.forEach(function(childrens) {
			categories.flattenCategories(allCategories, childrens);
		 	childrenCids = childrenCids.concat(allCategories.map(function(category) {
		 		return category && category.cid;
		 	}));
		 });

		callback(null, childrenCids);
	});
}

function getSearchUids(data, callback) {
	if (data.postedBy) {
		user.getUidsByUsernames(Array.isArray(data.postedBy) ? data.postedBy : [data.postedBy], callback);
	} else {
		callback(null, []);
	}
}

search.searchQuery = function(index, content, cids, uids, callback) {
	plugins.fireHook('filter:search.query', {
		index: index,
		content: content,
		cid: cids,
		uid: uids
	}, callback);
};

