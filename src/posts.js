'use strict';

var async = require('async'),
	_ = require('underscore'),

	db = require('./database'),
	utils = require('../public/src/utils'),
	user = require('./user'),
	topics = require('./topics'),
	postTools = require('./postTools'),
	plugins = require('./plugins');

(function(Posts) {

	require('./posts/create')(Posts);
	require('./posts/delete')(Posts);
	require('./posts/user')(Posts);
	require('./posts/category')(Posts);
	require('./posts/summary')(Posts);
	require('./posts/recent')(Posts);
	require('./posts/flags')(Posts);

	Posts.exists = function(pid, callback) {
		db.isSortedSetMember('posts:pid', pid, callback);
	};

	Posts.getPostsByTid = function(tid, set, start, end, uid, reverse, callback) {
		Posts.getPidsFromSet(set, start, end, reverse, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if(!Array.isArray(pids) || !pids.length) {
				return callback(null, []);
			}

			Posts.getPostsByPids(pids, uid, callback);
		});
	};

	Posts.getPidsFromSet = function(set, start, end, reverse, callback) {
		if (isNaN(start) || isNaN(end)) {
			return callback(null, []);
		}
		db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, end, callback);
	};

	Posts.getPostsByPids = function(pids, uid, callback) {
		var keys = [];

		for(var x=0, numPids=pids.length; x<numPids; ++x) {
			keys.push('post:' + pids[x]);
		}

		db.getObjects(keys, function(err, data) {
			if(err) {
				return callback(err);
			}

			async.map(data, function(postData, next) {
				if(!postData) {
					return next(null);
				}

				postData.relativeTime = utils.toISOString(postData.timestamp);
				postData.relativeEditTime = parseInt(postData.edited, 10) !== 0 ? utils.toISOString(postData.edited) : '';
				postTools.parsePost(postData, uid, next);
			}, function(err, posts) {
				if (err) {
					return callback(err);
				}

				plugins.fireHook('filter:post.getPosts', {posts: posts, uid: uid}, function(err, data) {
					if (err) {
						return callback(err);
					}

					if (!data || !Array.isArray(data.posts)) {
						return callback(null, []);
					}
					data.posts = data.posts.filter(Boolean);
					callback(null, data.posts);
				});
			});
		});
	};

	Posts.getPostData = function(pid, callback) {
		db.getObject('post:' + pid, function(err, data) {
			if(err) {
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

			plugins.fireHook('filter:post.getFields', {posts: [data], fields: fields}, callback);
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
			plugins.fireHook('filter:post.getFields', {posts: posts, fields: fields}, callback);
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
			plugins.fireHook('action:post.setField', data);
			callback();
		});
	};

	Posts.setPostFields = function(pid, data, callback) {
		db.setObject('post:' + pid, data, function(err) {
			if (err) {
				return callback(err);
			}
			data.pid = pid;
			plugins.fireHook('action:post.setField', data);
			callback();
		});
	};

	Posts.getPidIndex = function(pid, uid, callback) {
		async.parallel({
			settings: function(next) {
				user.getSettings(uid, next);
			},
			tid: function(next) {
				Posts.getPostField(pid, 'tid', next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}
			var set = results.settings.topicPostSort === 'most_votes' ? 'tid:' + results.tid + ':posts:votes' : 'tid:' + results.tid + ':posts';
			db.sortedSetRank(set, pid, function(err, index) {
				if (!utils.isNumber(index)) {
					return callback(err, 1);
				}
				callback(err, parseInt(index, 10) + 2);
			});
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

	Posts.isMain = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(err, tid) {
			if (err) {
				return callback(err);
			}
			topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
				callback(err, parseInt(pid, 10) === parseInt(mainPid, 10));
			});
		});
	};

	Posts.updatePostVoteCount = function(pid, voteCount, callback) {
		async.parallel([
			function(next) {
				Posts.getPostField(pid, 'tid', function(err, tid) {
					if (err) {
						return next(err);
					}
					topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
						if (err) {
							return next(err);
						}
						if (parseInt(mainPid, 10) === parseInt(pid, 10)) {
							return next();
						}
						db.sortedSetAdd('tid:' + tid + ':posts:votes', voteCount, pid, next);
					});
				});
			},
			function(next) {
				Posts.setPostField(pid, 'votes', voteCount, next);
			}
		], callback);
	};

}(exports));
