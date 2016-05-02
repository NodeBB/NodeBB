'use strict';

var async = require('async');
var _ = require('underscore');

var db = require('./database');
var utils = require('../public/src/utils');
var user = require('./user');
var topics = require('./topics');
var privileges = require('./privileges');
var plugins = require('./plugins');

(function(Posts) {

	require('./posts/create')(Posts);
	require('./posts/delete')(Posts);
	require('./posts/edit')(Posts);
	require('./posts/parse')(Posts);
	require('./posts/user')(Posts);
	require('./posts/topics')(Posts);
	require('./posts/category')(Posts);
	require('./posts/summary')(Posts);
	require('./posts/recent')(Posts);
	require('./posts/flags')(Posts);
	require('./posts/tools')(Posts);

	Posts.exists = function(pid, callback) {
		db.isSortedSetMember('posts:pid', pid, callback);
	};

	Posts.getPidsFromSet = function(set, start, stop, reverse, callback) {
		if (isNaN(start) || isNaN(stop)) {
			return callback(null, []);
		}
		db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop, callback);
	};

	Posts.getPostsByPids = function(pids, uid, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		var keys = [];

		for (var x=0, numPids=pids.length; x<numPids; ++x) {
			keys.push('post:' + pids[x]);
		}

		async.waterfall([
			function(next) {
				db.getObjects(keys, next);
			},
			function(posts, next) {
				async.map(posts, function(post, next) {
					if (!post) {
						return next();
					}

					post.timestampISO = utils.toISOString(post.timestamp);
					post.editedISO = parseInt(post.edited, 10) !== 0 ? utils.toISOString(post.edited) : '';
					Posts.parsePost(post, next);
				}, next);
			},
			function(posts, next) {
				plugins.fireHook('filter:post.getPosts', {posts: posts, uid: uid}, next);
			},
			function(data, next) {
				if (!data || !Array.isArray(data.posts)) {
					return next(null, []);
				}
				data.posts = data.posts.filter(Boolean);
				next(null, data.posts);
			}
		], callback);
	};

	Posts.getPostSummariesFromSet = function(set, uid, start, stop, callback) {
		async.waterfall([
			function(next) {
				db.getSortedSetRevRange(set, start, stop, next);
			},
			function(pids, next) {
				privileges.posts.filter('read', pids, uid, next);
			},
			function(pids, next) {
				Posts.getPostSummaryByPids(pids, uid, {stripTags: false}, next);
			},
			function(posts, next) {
				next(null, {posts: posts, nextStart: stop + 1});
			}
		], callback);
	};

	Posts.getPostData = function(pid, callback) {
		db.getObject('post:' + pid, function(err, data) {
			if (err) {
				return callback(err);
			}

			plugins.fireHook('filter:post.get', data, callback);
		});
	};

	Posts.getPostField = function(pid, field, callback) {
		Posts.getPostFields(pid, [field], function(err, data) {
			if (err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	};

	Posts.getPostFields = function(pid, fields, callback) {
		db.getObjectFields('post:' + pid, fields, function(err, data) {
			if (err) {
				return callback(err);
			}

			data.pid = pid;

			plugins.fireHook('filter:post.getFields', {posts: [data], fields: fields}, function(err, data) {
				callback(err, (data && Array.isArray(data.posts) && data.posts.length) ? data.posts[0] : null);
			});
		});
	};

	Posts.getPostsFields = function(pids, fields, callback) {
		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		var keys = pids.map(function(pid) {
			return 'post:' + pid;
		});

		db.getObjectsFields(keys, fields, function(err, posts) {
			if (err) {
				return callback(err);
			}
			plugins.fireHook('filter:post.getFields', {posts: posts, fields: fields}, function(err, data) {
				callback(err, (data && Array.isArray(data.posts)) ? data.posts : null);
			});
		});
	};

	Posts.setPostField = function(pid, field, value, callback) {
		db.setObjectField('post:' + pid, field, value, function(err) {
			if (err) {
				return callback(err);
			}
			var data = {
				pid: pid
			};
			data[field] = value;
			plugins.fireHook('action:post.setFields', data);
			callback();
		});
	};

	Posts.setPostFields = function(pid, data, callback) {
		db.setObject('post:' + pid, data, function(err) {
			if (err) {
				return callback(err);
			}
			data.pid = pid;
			plugins.fireHook('action:post.setFields', data);
			callback();
		});
	};

	Posts.getPidIndex = function(pid, tid, topicPostSort, callback) {
		var set = topicPostSort === 'most_votes' ? 'tid:' + tid + ':posts:votes' : 'tid:' + tid + ':posts';
		db.sortedSetRank(set, pid, function(err, index) {
			if (!utils.isNumber(index)) {
				return callback(err, 0);
			}
			callback(err, parseInt(index, 10) + 1);
		});
	};

	Posts.getPostIndices = function(posts, uid, callback) {
		if (!Array.isArray(posts) || !posts.length) {
			return callback(null, []);
		}

		user.getSettings(uid, function(err, settings) {
			if (err) {
				return callback(err);
			}

			var byVotes = settings.topicPostSort === 'most_votes';
			var sets = posts.map(function(post) {
				return byVotes ? 'tid:' + post.tid + ':posts:votes' : 'tid:' + post.tid + ':posts';
			});

			var uniqueSets = _.uniq(sets);
			var method = 'sortedSetsRanks';
			if (uniqueSets.length === 1) {
				method = 'sortedSetRanks';
				sets = uniqueSets[0];
			}

			var pids = posts.map(function(post) {
				return post.pid;
			});

			db[method](sets, pids, function(err, indices) {
				if (err) {
					return callback(err);
				}

				for (var i=0; i<indices.length; ++i) {
					indices[i] = utils.isNumber(indices[i]) ? parseInt(indices[i], 10) + 1 : 0;
				}

				callback(null, indices);
			});
		});
	};

	Posts.updatePostVoteCount = function(postData, voteCount, callback) {
		if (!postData || !postData.pid || !postData.tid) {
			return callback();
		}
		async.parallel([
			function (next) {
				if (postData.uid) {
					db.sortedSetAdd('uid:' + postData.uid + ':posts:votes', voteCount, postData.pid, next);
				} else {
					next();
				}
			},
			function (next) {
				async.waterfall([
					function (next) {
						topics.getTopicField(postData.tid, 'mainPid', next);
					},
					function (mainPid, next) {
						if (parseInt(mainPid, 10) === parseInt(postData.pid, 10)) {
							return next();
						}
						db.sortedSetAdd('tid:' + postData.tid + ':posts:votes', voteCount, postData.pid, next);
					}
				], next);
			},
			function (next) {
				Posts.setPostField(postData.pid, 'votes', voteCount, next);
			}
		], function(err) {
			callback(err);
		});
	};

}(exports));
