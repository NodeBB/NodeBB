'use strict';

var async = require('async');
var _ = require('lodash');

var db = require('../database');
var utils = require('../utils');
var user = require('../user');
var topics = require('../topics');
var privileges = require('../privileges');
var plugins = require('../plugins');

var Posts = module.exports;

require('./data')(Posts);
require('./create')(Posts);
require('./delete')(Posts);
require('./edit')(Posts);
require('./parse')(Posts);
require('./user')(Posts);
require('./topics')(Posts);
require('./category')(Posts);
require('./summary')(Posts);
require('./recent')(Posts);
require('./tools')(Posts);
require('./votes')(Posts);
require('./bookmarks')(Posts);
require('./queue')(Posts);
require('./diffs')(Posts);
require('./uploads')(Posts);

Posts.exists = function (pid, callback) {
	db.exists('post:' + pid, callback);
};

Posts.getPidsFromSet = function (set, start, stop, reverse, callback) {
	if (isNaN(start) || isNaN(stop)) {
		return setImmediate(callback, null, []);
	}
	db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop, callback);
};

Posts.getPostsByPids = function (pids, uid, callback) {
	if (!Array.isArray(pids) || !pids.length) {
		return callback(null, []);
	}

	async.waterfall([
		function (next) {
			Posts.getPostsData(pids, next);
		},
		function (posts, next) {
			async.map(posts, Posts.parsePost, next);
		},
		function (posts, next) {
			user.blocks.filter(uid, posts, next);
		},
		function (posts, next) {
			plugins.fireHook('filter:post.getPosts', { posts: posts, uid: uid }, next);
		},
		function (data, next) {
			if (!data || !Array.isArray(data.posts)) {
				return next(null, []);
			}
			data.posts = data.posts.filter(Boolean);
			next(null, data.posts);
		},
	], callback);
};

Posts.getPostSummariesFromSet = function (set, uid, start, stop, callback) {
	async.waterfall([
		function (next) {
			db.getSortedSetRevRange(set, start, stop, next);
		},
		function (pids, next) {
			privileges.posts.filter('read', pids, uid, next);
		},
		function (pids, next) {
			Posts.getPostSummaryByPids(pids, uid, { stripTags: false }, next);
		},
		function (posts, next) {
			next(null, { posts: posts, nextStart: stop + 1 });
		},
	], callback);
};

Posts.getPidIndex = function (pid, tid, topicPostSort, callback) {
	async.waterfall([
		function (next) {
			var set = topicPostSort === 'most_votes' ? 'tid:' + tid + ':posts:votes' : 'tid:' + tid + ':posts';
			db.sortedSetRank(set, pid, next);
		},
		function (index, next) {
			if (!utils.isNumber(index)) {
				return next(null, 0);
			}
			next(null, parseInt(index, 10) + 1);
		},
	], callback);
};

Posts.getPostIndices = function (posts, uid, callback) {
	if (!Array.isArray(posts) || !posts.length) {
		return callback(null, []);
	}

	async.waterfall([
		function (next) {
			user.getSettings(uid, next);
		},
		function (settings, next) {
			var byVotes = settings.topicPostSort === 'most_votes';
			var sets = posts.map(function (post) {
				return byVotes ? 'tid:' + post.tid + ':posts:votes' : 'tid:' + post.tid + ':posts';
			});

			var uniqueSets = _.uniq(sets);
			var method = 'sortedSetsRanks';
			if (uniqueSets.length === 1) {
				method = 'sortedSetRanks';
				sets = uniqueSets[0];
			}

			var pids = posts.map(function (post) {
				return post.pid;
			});

			db[method](sets, pids, next);
		},
		function (indices, next) {
			for (var i = 0; i < indices.length; i += 1) {
				indices[i] = utils.isNumber(indices[i]) ? parseInt(indices[i], 10) + 1 : 0;
			}

			next(null, indices);
		},
	], callback);
};

Posts.updatePostVoteCount = function (postData, callback) {
	if (!postData || !postData.pid || !postData.tid) {
		return callback();
	}
	async.parallel([
		function (next) {
			if (postData.uid) {
				if (postData.votes > 0) {
					db.sortedSetAdd('uid:' + postData.uid + ':posts:votes', postData.votes, postData.pid, next);
				} else {
					db.sortedSetRemove('uid:' + postData.uid + ':posts:votes', postData.pid, next);
				}
			} else {
				next();
			}
		},
		function (next) {
			async.waterfall([
				function (next) {
					topics.getTopicFields(postData.tid, ['mainPid', 'cid', 'pinned'], next);
				},
				function (topicData, next) {
					if (parseInt(topicData.mainPid, 10) === parseInt(postData.pid, 10)) {
						async.parallel([
							function (next) {
								topics.setTopicFields(postData.tid, {
									upvotes: postData.upvotes,
									downvotes: postData.downvotes,
								}, next);
							},
							function (next) {
								db.sortedSetAdd('topics:votes', postData.votes, postData.tid, next);
							},
							function (next) {
								if (!topicData.pinned) {
									db.sortedSetAdd('cid:' + topicData.cid + ':tids:votes', postData.votes, postData.tid, next);
								} else {
									next();
								}
							},
						], function (err) {
							next(err);
						});
						return;
					}
					db.sortedSetAdd('tid:' + postData.tid + ':posts:votes', postData.votes, postData.pid, next);
				},
			], next);
		},
		function (next) {
			db.sortedSetAdd('posts:votes', postData.votes, postData.pid, next);
		},
		function (next) {
			Posts.setPostFields(postData.pid, {
				upvotes: postData.upvotes,
				downvotes: postData.downvotes,
			}, next);
		},
	], function (err) {
		callback(err);
	});
};

Posts.modifyPostByPrivilege = function (post, privileges) {
	if (post.deleted && !(post.selfPost || privileges['posts:view_deleted'])) {
		post.content = '[[topic:post_is_deleted]]';
		if (post.user) {
			post.user.signature = '';
		}
	}
};

Posts.async = require('../promisify')(Posts);
