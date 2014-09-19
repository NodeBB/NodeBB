

'use strict';

var async = require('async'),
	winston = require('winston'),

	db = require('../database'),
	user = require('../user'),
	favourites = require('../favourites'),
	posts = require('../posts'),
	privileges = require('../privileges');

module.exports = function(Topics) {

	Topics.onNewPostMade = function(postData, callback) {
		async.parallel([
			function(next) {
				Topics.increasePostCount(postData.tid, next);
			},
			function(next) {
				Topics.updateTimestamp(postData.tid, postData.timestamp, next);
			},
			function(next) {
				Topics.addPostToTopic(postData.tid, postData.pid, postData.timestamp, 0, next);
			}
		], callback);
	};


	Topics.getTopicPosts = function(tid, set, start, end, uid, reverse, callback) {
		callback = callback || function() {};
		posts.getPostsByTid(tid, set, start, end, uid, reverse, function(err, postData) {
			if(err) {
				return callback(err);
			}

			if (Array.isArray(postData) && !postData.length) {
				return callback(null, []);
			}

			Topics.addPostData(postData, uid, callback);
		});
	};

	Topics.addPostData = function(postData, uid, callback) {
		var pids = postData.map(function(post) {
			return post && post.pid;
		});

		if (!Array.isArray(pids) || !pids.length) {
			return callback(null, []);
		}

		async.parallel({
			favourites: function(next) {
				favourites.getFavouritesByPostIDs(pids, uid, next);
			},
			voteData: function(next) {
				favourites.getVoteStatusByPostIDs(pids, uid, next);
			},
			userData: function(next) {
				var uids = [];

				for(var i=0; i<postData.length; ++i) {
					if (postData[i] && uids.indexOf(postData[i].uid) === -1) {
						uids.push(postData[i].uid);
					}
				}

				posts.getUserInfoForPosts(uids, function(err, users) {
					if (err) {
						return next(err);
					}

					var userData = {};
					users.forEach(function(user, index) {
						userData[uids[index]] = user;
					});

					next(null, userData);
				});
			},
			editors: function(next) {
				var editors = [];
				for(var i=0; i<postData.length; ++i) {
					if (postData[i] && postData[i].editor && editors.indexOf(postData[i].editor) === -1) {
						editors.push(postData[i].editor);
					}
				}

				user.getMultipleUserFields(editors, ['uid', 'username', 'userslug'], function(err, editors) {
					if (err) {
						return next(err);
					}
					var editorData = {};
					editors.forEach(function(editor) {
						editorData[editor.uid] = editor;
					});
					next(null, editorData);
				});
			},
			privileges: function(next) {
				privileges.posts.get(pids, uid, next);
			},
			indices: function(next) {
				posts.getPostIndices(postData, uid, next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}

			for (var i = 0; i < postData.length; ++i) {
				if (postData[i]) {
					postData[i].index = results.indices[i];
					postData[i].deleted = parseInt(postData[i].deleted, 10) === 1;
					postData[i].user = results.userData[postData[i].uid];
					postData[i].editor = postData[i].editor ? results.editors[postData[i].editor] : null;
					postData[i].favourited = results.favourites[i];
					postData[i].upvoted = results.voteData.upvotes[i];
					postData[i].downvoted = results.voteData.downvotes[i];
					postData[i].votes = postData[i].votes || 0;
					postData[i].display_moderator_tools = results.privileges[i].editable;
					postData[i].display_move_tools = results.privileges[i].move && postData[i].index !== 0;
					postData[i].selfPost = parseInt(uid, 10) === parseInt(postData[i].uid, 10);

					if(postData[i].deleted && !results.privileges[i].view_deleted) {
						postData[i].content = '[[topic:post_is_deleted]]';
					}
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
		async.parallel({
			mainPid: function(next) {
				Topics.getTopicField(tid, 'mainPid', next);
			},
			pids: function(next) {
				db.getSortedSetRevRange('tid:' + tid + ':posts', 0, -1, next);
			}
		}, function(err, results) {
			if(err) {
				return callback(err);
			}

			if (!results.mainPid && (!Array.isArray(results.pids) || !results.pids.length)) {
				return callback(null, null);
			}

			results.pids.push(results.mainPid);

			async.detectSeries(results.pids, function(pid, next) {
				posts.getPostField(pid, 'deleted', function(err, deleted) {
					next(parseInt(deleted, 10) === 0);
				});
			}, function(pid) {
				callback(null, pid ? pid.toString() : null);
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
		async.parallel({
			mainPid: function(next) {
				Topics.getTopicField(tid, 'mainPid', next);
			},
			pids: function(next) {
				db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}
			if (results.mainPid) {
				results.pids = [results.mainPid].concat(results.pids);
			}
			callback(null, results.pids);
		});
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
		callback = callback || function() {};
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
			if (err) {
				return callback(err);
			}
			Topics.getTopicData(tid, callback);
		});
	};

	Topics.getPostCount = function(tid, callback) {
		db.sortedSetCard('tid:' + tid + ':posts', callback);
	};

};
