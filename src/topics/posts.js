

'use strict';

var async = require('async'),

	db = require('../database'),
	user = require('../user'),
	emitter = require('../emitter'),
	favourites = require('../favourites'),
	posts = require('../posts'),
	privileges = require('../privileges');

module.exports = function(Topics) {

	Topics.onNewPostMade = function(postData) {
		Topics.increasePostCount(postData.tid);
		Topics.updateTimestamp(postData.tid, postData.timestamp);
		Topics.addPostToTopic(postData.tid, postData.pid, postData.timestamp, 0);
	};

	emitter.on('event:newpost', Topics.onNewPostMade);

	Topics.getTopicPosts = function(tid, set, start, end, uid, reverse, callback) {
		posts.getPostsByTid(tid, set, start, end, reverse, function(err, postData) {
			if(err) {
				return callback(err);
			}

			if (Array.isArray(postData) && !postData.length) {
				return callback(null, []);
			}

			start = parseInt(start, 10);
			for(var i=0; i<postData.length; ++i) {
				postData[i].index = start + i + 1;
			}

			Topics.addPostData(postData, uid, callback);
		});
	};

	Topics.addPostData = function(postData, uid, callback) {
		var pids = postData.map(function(post) {
			return post.pid;
		});

		async.parallel({
			favourites: function(next) {
				favourites.getFavouritesByPostIDs(pids, uid, next);
			},
			voteData: function(next) {
				favourites.getVoteStatusByPostIDs(pids, uid, next);
			},
			userData: function(next) {
				async.each(postData, function(post, next) {
					async.parallel({
						editor: function(next) {
							if (!post.editor) {
								return next();
							}
							user.getUserFields(post.editor, ['username', 'userslug'], next);
						},
						user: function(next) {
							posts.getUserInfoForPost(post, next);
						}
					}, function(err, results) {
						if (err) {
							return next(err);
						}

						post.user = results.user;
						post.editor = results.editor;
						next();
					});
				}, next);
			},
			privileges: function(next) {
				async.map(pids, function (pid, next) {
					privileges.posts.get(pid, uid, next);
				}, next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}

			for (var i = 0; i < postData.length; ++i) {
				postData[i].deleted = parseInt(postData[i].deleted, 10) === 1;
				postData[i].favourited = results.favourites[i];
				postData[i].upvoted = results.voteData[i].upvoted;
				postData[i].downvoted = results.voteData[i].downvoted;
				postData[i].votes = postData[i].votes || 0;
				postData[i].display_moderator_tools = results.privileges[i].editable;
				postData[i].display_move_tools = results.privileges[i].move;
				postData[i].selfPost = parseInt(uid, 10) === parseInt(postData[i].uid, 10);

				if(postData[i].deleted && !results.privileges[i].view_deleted) {
					postData[i].content = '[[topic:post_is_deleted]]';
				}
			}

			callback(null, postData);
		});
	};

	Topics.getLatestUndeletedPost = function(tid, callback) {
		Topics.getLatestUndeletedPid(tid, function(err, pid) {
			if(err) {
				return callback(err);
			}

			posts.getPostData(pid, callback);
		});
	};

	Topics.getLatestUndeletedPid = function(tid, callback) {
		db.getSortedSetRevRange('tid:' + tid + ':posts', 0, -1, function(err, pids) {
			if(err) {
				return callback(err);
			}

			if (!pids || !pids.length) {
				return callback(null, null);
			}

			async.detectSeries(pids, function(pid, next) {
				posts.getPostField(pid, 'deleted', function(err, deleted) {
					next(parseInt(deleted, 10) === 0);
				});
			}, function(pid) {
				callback(null, pid ? pid : null);
			});
		});
	};

	Topics.addPostToTopic = function(tid, pid, timestamp, votes, callback) {
		Topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
			if (!parseInt(mainPid, 10)) {
				Topics.setTopicField(tid, 'mainPid', pid, callback);
			} else {
				async.parallel([
					function(next) {
						db.sortedSetAdd('tid:' + tid + ':posts', timestamp, pid, next);
					},
					function(next) {
						db.sortedSetAdd('tid:' + tid + ':posts:votes', votes, pid, next);
					}
				], callback);
			}
		});
	};

	Topics.removePostFromTopic = function(tid, pid, callback) {
		async.parallel([
			function (next) {
				db.sortedSetRemove('tid:' + tid + ':posts', pid, next);
			},
			function (next) {
				db.sortedSetRemove('tid:' + tid + ':posts:votes', pid, next);
			}
		], callback);
	};

	Topics.getPids = function(tid, callback) {
		db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, callback);
	};

	Topics.increasePostCount = function(tid, callback) {
		incrementFieldAndUpdateSortedSet(tid, 'postcount', 1, 'topics:posts', callback);
	};

	Topics.decreasePostCount = function(tid, callback) {
		incrementFieldAndUpdateSortedSet(tid, 'postcount', -1, 'topics:posts', callback);
	};

	Topics.increaseViewCount = function(tid, callback) {
		incrementFieldAndUpdateSortedSet(tid, 'viewcount', 1, 'topics:views', callback);
	};

	function incrementFieldAndUpdateSortedSet(tid, field, by, set, callback) {
		db.incrObjectFieldBy('topic:' + tid, field, by, function(err, value) {
			if(err) {
				return callback(err);
			}
			db.sortedSetAdd(set, value, tid, callback);
		});
	}

	Topics.getTitleByPid = function(pid, callback) {
		Topics.getTopicFieldByPid('title', pid, callback);
	};

	Topics.getTopicFieldByPid = function(field, pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			Topics.getTopicField(tid, field, callback);
		});
	};

	Topics.getTopicDataByPid = function(pid, callback) {
		posts.getPostField(pid, 'tid', function(err, tid) {
			Topics.getTopicData(tid, callback);
		});
	};

	Topics.getPostCount = function(tid, callback) {
		db.sortedSetCard('tid:' + tid + ':posts', callback);
	};

};
