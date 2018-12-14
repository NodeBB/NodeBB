'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('./database');
var posts = require('./posts');
var topics = require('./topics');
var categories = require('./categories');
var user = require('./user');
var plugins = require('./plugins');
var privileges = require('./privileges');
var utils = require('./utils');

var search = module.exports;

search.search = function (data, callback) {
	var start = process.hrtime();
	data.searchIn = data.searchIn || 'titlesposts';
	data.sortBy = data.sortBy || 'relevance';
	async.waterfall([
		function (next) {
			if (data.searchIn === 'posts' || data.searchIn === 'titles' || data.searchIn === 'titlesposts') {
				searchInContent(data, next);
			} else if (data.searchIn === 'users') {
				user.search(data, next);
			} else if (data.searchIn === 'tags') {
				topics.searchAndLoadTags(data, next);
			} else {
				next(new Error('[[error:unknown-search-filter]]'));
			}
		},
		function (result, next) {
			result.time = (process.elapsedTimeSince(start) / 1000).toFixed(2);
			next(null, result);
		},
	], callback);
};

function searchInContent(data, callback) {
	data.uid = data.uid || 0;
	var pids;
	var metadata;
	var itemsPerPage = Math.min(data.itemsPerPage || 10, 100);
	const returnData = {
		posts: [],
		matchCount: 0,
		pageCount: 1,
	};
	async.waterfall([
		function (next) {
			async.parallel({
				searchCids: async.apply(getSearchCids, data),
				searchUids: async.apply(getSearchUids, data),
			}, next);
		},
		function (results, next) {
			function doSearch(type, searchIn, next) {
				if (searchIn.includes(data.searchIn)) {
					plugins.fireHook('filter:search.query', {
						index: type,
						content: data.query,
						matchWords: data.matchWords || 'all',
						cid: results.searchCids,
						uid: results.searchUids,
						searchData: data,
					}, next);
				} else {
					next(null, []);
				}
			}
			async.parallel({
				pids: async.apply(doSearch, 'post', ['posts', 'titlesposts']),
				tids: async.apply(doSearch, 'topic', ['titles', 'titlesposts']),
			}, next);
		},
		function (results, next) {
			pids = results.pids;

			if (data.returnIds) {
				return callback(null, results);
			}

			if (!results.pids.length && !results.tids.length) {
				return callback(null, returnData);
			}

			topics.getMainPids(results.tids, next);
		},
		function (mainPids, next) {
			pids = mainPids.concat(pids).filter(Boolean);

			privileges.posts.filter('read', pids, data.uid, next);
		},
		function (pids, next) {
			filterAndSort(pids, data, next);
		},
		function (pids, next) {
			plugins.fireHook('filter:search.inContent', {
				pids: pids,
			}, next);
		},
		function (_metadata, next) {
			metadata = _metadata;
			returnData.matchCount = metadata.pids.length;
			returnData.pageCount = Math.max(1, Math.ceil(parseInt(returnData.matchCount, 10) / itemsPerPage));

			if (data.page) {
				const start = Math.max(0, (data.page - 1)) * itemsPerPage;
				metadata.pids = metadata.pids.slice(start, start + itemsPerPage);
			}

			posts.getPostSummaryByPids(metadata.pids, data.uid, {}, next);
		},
		function (posts, next) {
			returnData.posts = posts;
			// Append metadata to returned payload (without pids)
			delete metadata.pids;
			next(null, Object.assign(returnData, metadata));
		},
	], callback);
}

function filterAndSort(pids, data, callback) {
	if (data.sortBy === 'relevance' && !data.replies && !data.timeRange && !data.hasTags) {
		return setImmediate(callback, null, pids);
	}

	async.waterfall([
		function (next) {
			getMatchedPosts(pids, data, next);
		},
		function (posts, next) {
			if (!posts.length) {
				return callback(null, pids);
			}
			posts = posts.filter(Boolean);

			posts = filterByPostcount(posts, data.replies, data.repliesFilter);
			posts = filterByTimerange(posts, data.timeRange, data.timeFilter);
			posts = filterByTags(posts, data.hasTags);

			sortPosts(posts, data);

			plugins.fireHook('filter:search.filterAndSort', { pids: pids, posts: posts, data: data }, next);
		},
		function (result, next) {
			pids = result.posts.map(post => post && post.pid);
			next(null, pids);
		},
	], callback);
}

function getMatchedPosts(pids, data, callback) {
	var postFields = ['pid', 'uid', 'tid', 'timestamp', 'deleted', 'upvotes', 'downvotes'];
	var categoryFields = [];

	if (data.sortBy.startsWith('category.')) {
		categoryFields.push(data.sortBy.split('.')[1]);
	}

	var postsData;
	let tids;
	let uids;
	async.waterfall([
		function (next) {
			posts.getPostsFields(pids, postFields, next);
		},
		function (_postsData, next) {
			postsData = _postsData.filter(post => post && !post.deleted);

			async.parallel({
				users: function (next) {
					if (data.sortBy.startsWith('user')) {
						uids = _.uniq(postsData.map(post => post.uid));
						user.getUsersFields(uids, ['username'], next);
					} else {
						next();
					}
				},
				topics: function (next) {
					var topicsData;
					tids = _.uniq(postsData.map(post => post.tid));
					let cids;
					async.waterfall([
						function (next) {
							topics.getTopicsData(tids, next);
						},
						function (_topics, next) {
							topicsData = _topics;
							async.parallel({
								categories: function (next) {
									if (!categoryFields.length) {
										return next();
									}

									cids = _.uniq(topicsData.map(topic => topic && topic.cid));
									db.getObjectsFields(cids.map(cid => 'category:' + cid), categoryFields, next);
								},
								tags: function (next) {
									if (Array.isArray(data.hasTags) && data.hasTags.length) {
										topics.getTopicsTags(tids, next);
									} else {
										setImmediate(next);
									}
								},
							}, next);
						},
						function (results, next) {
							const cidToCategory = _.zipObject(cids, results.categories);
							topicsData.forEach(function (topic, index) {
								if (topic && results.categories && cidToCategory[topic.cid]) {
									topic.category = cidToCategory[topic.cid];
								}
								if (topic && results.tags && results.tags[index]) {
									topic.tags = results.tags[index];
								}
							});

							next(null, topicsData);
						},
					], next);
				},
			}, next);
		},
		function (results, next) {
			const tidToTopic = _.zipObject(tids, results.topics);
			const uidToUser = _.zipObject(uids, results.users);
			postsData.forEach(function (post) {
				if (results.topics && tidToTopic[post.tid]) {
					post.topic = tidToTopic[post.tid];
					if (post.topic && post.topic.category) {
						post.category = post.topic.category;
					}
				}

				if (uidToUser[post.uid]) {
					post.user = uidToUser[post.uid];
				}
			});

			postsData = postsData.filter(post => post && post.topic && !post.topic.deleted);
			next(null, postsData);
		},
	], callback);
}

function filterByPostcount(posts, postCount, repliesFilter) {
	postCount = parseInt(postCount, 10);
	if (postCount) {
		if (repliesFilter === 'atleast') {
			posts = posts.filter(post => post.topic && post.topic.postcount >= postCount);
		} else {
			posts = posts.filter(post => post.topic && post.topic.postcount <= postCount);
		}
	}
	return posts;
}

function filterByTimerange(posts, timeRange, timeFilter) {
	timeRange = parseInt(timeRange, 10) * 1000;
	if (timeRange) {
		const time = Date.now() - timeRange;
		if (timeFilter === 'newer') {
			posts = posts.filter(post => post.timestamp >= time);
		} else {
			posts = posts.filter(post => post.timestamp <= time);
		}
	}
	return posts;
}

function filterByTags(posts, hasTags) {
	if (Array.isArray(hasTags) && hasTags.length) {
		posts = posts.filter(function (post) {
			var hasAllTags = false;
			if (post && post.topic && Array.isArray(post.topic.tags) && post.topic.tags.length) {
				hasAllTags = hasTags.every(tag => post.topic.tags.includes(tag));
			}
			return hasAllTags;
		});
	}
	return posts;
}

function sortPosts(posts, data) {
	if (!posts.length || data.sortBy === 'relevance') {
		return;
	}

	data.sortDirection = data.sortDirection || 'desc';
	var direction = data.sortDirection === 'desc' ? 1 : -1;
	const fields = data.sortBy.split('.');
	if (fields.length === 1) {
		return posts.sort((p1, p2) => direction * (p2[fields[0]] - p1[fields[0]]));
	}

	var firstPost = posts[0];
	if (!fields || fields.length !== 2 || !firstPost[fields[0]] || !firstPost[fields[0]][fields[1]]) {
		return;
	}

	var isNumeric = utils.isNumber(firstPost[fields[0]][fields[1]]);

	if (isNumeric) {
		posts.sort((p1, p2) => direction * (p2[fields[0]][fields[1]] - p1[fields[0]][fields[1]]));
	} else {
		posts.sort(function (p1, p2) {
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

	if (data.categories.includes('all')) {
		return categories.getCidsByPrivilege('categories:cid', data.uid, 'read', callback);
	}

	async.waterfall([
		function (next) {
			async.parallel({
				watchedCids: function (next) {
					if (data.categories.includes('watched')) {
						user.getCategoriesByStates(data.uid, [categories.watchStates.watching], next);
					} else {
						setImmediate(next, null, []);
					}
				},
				childrenCids: function (next) {
					if (data.searchChildren) {
						getChildrenCids(data.categories, data.uid, next);
					} else {
						setImmediate(next, null, []);
					}
				},
			}, next);
		},
		function (results, next) {
			const cids = _.uniq(results.watchedCids.concat(results.childrenCids).concat(data.categories).filter(Boolean));
			next(null, cids);
		},
	], callback);
}

function getChildrenCids(cids, uid, callback) {
	async.waterfall([
		function (next) {
			async.map(cids, categories.getChildrenCids, next);
		},
		function (childrenCids, next) {
			privileges.categories.filterCids('find', _.uniq(_.flatten(childrenCids)), uid, next);
		},
	], callback);
}

function getSearchUids(data, callback) {
	if (data.postedBy) {
		user.getUidsByUsernames(Array.isArray(data.postedBy) ? data.postedBy : [data.postedBy], callback);
	} else {
		setImmediate(callback, null, []);
	}
}
