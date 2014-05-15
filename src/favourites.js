var async = require('async'),

	db = require('./database'),
	posts = require('./posts'),
	user = require('./user');

(function (Favourites) {
	"use strict";

	function vote(type, unvote, pid, uid, callback) {
		uid = parseInt(uid, 10);

		if (uid === 0) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		posts.getPostFields(pid, ['pid', 'uid', 'timestamp'], function (err, postData) {
			if (err) {
				return callback(err);
			}

			if (uid === parseInt(postData.uid, 10)) {
				return callback(new Error('[[error:cant-vote-self-post]]'));
			}

			if(type === 'upvote' && !unvote) {
				db.sortedSetAdd('uid:' + uid + ':upvote', postData.timestamp, pid);
			} else {
				db.sortedSetRemove('uid:' + uid + ':upvote', pid);
			}

			if(type === 'upvote' || unvote) {
				db.sortedSetRemove('uid:' + uid + ':downvote', pid);
			} else {
				db.sortedSetAdd('uid:' + uid + ':downvote', postData.timestamp, pid);
			}

			user[type === 'upvote' ? 'incrementUserFieldBy' : 'decrementUserFieldBy'](postData.uid, 'reputation', 1, function (err, newreputation) {
				if (err) {
					return callback(err);
				}

				db.sortedSetAdd('users:reputation', newreputation, postData.uid);

				adjustPostVotes(pid, uid, type, unvote, function(err, votes) {
					postData.votes = votes;
					callback(err, {
						user: {
							reputation: newreputation
						},
						post: postData,
						upvote: type === 'upvote' && !unvote,
						downvote: type === 'downvote' && !unvote
					});
				});
			});
		});
	}

	function adjustPostVotes(pid, uid, type, unvote, callback) {
		var notType = (type === 'upvote' ? 'downvote' : 'upvote');

		async.series([
			function(next) {
				if (unvote) {
					db.setRemove('pid:' + pid + ':' + type, uid, next);
				} else {
					db.setAdd('pid:' + pid + ':' + type, uid, next);
				}
			},
			function(next) {
				db.setRemove('pid:' + pid + ':' + notType, uid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			async.parallel({
				upvotes: function(next) {
					db.setCount('pid:' + pid + ':upvote', next);
				},
				downvotes: function(next) {
					db.setCount('pid:' + pid + ':downvote', next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				var voteCount = parseInt(results.upvotes, 10) - parseInt(results.downvotes, 10);
				posts.setPostField(pid, 'votes', voteCount, function(err) {
					callback(err, voteCount);
				});
			});
		});
	}

	Favourites.upvote = function(pid, uid, callback) {
		toggleVote('upvote', pid, uid, callback);
	};

	Favourites.downvote = function(pid, uid, callback) {
		toggleVote('downvote', pid, uid, callback);
	};

	function toggleVote(type, pid, uid, callback) {
		Favourites.unvote(pid, uid, function(err) {
			if (err) {
				return callback(err);
			}

			vote(type, false, pid, uid, callback);
		});
	}

	Favourites.unvote = function(pid, uid, callback) {
		Favourites.hasVoted(pid, uid, function(err, voteStatus) {
			if (err) {
				return callback(err);
			}

			if (!voteStatus || (!voteStatus.upvoted && !voteStatus.downvoted)) {
				return callback();
			}

			vote(voteStatus.upvoted ? 'downvote' : 'upvote', true, pid, uid, callback);
		});
	};

	Favourites.hasVoted = function(pid, uid, callback) {
		async.parallel({
			upvoted: function(next) {
				db.isSetMember('pid:' + pid + ':upvote', uid, next);
			},
			downvoted: function(next) {
				db.isSetMember('pid:' + pid + ':downvote', uid, next);
			}
		}, callback);
	};

	Favourites.getVoteStatusByPostIDs = function(pids, uid, callback) {
		async.map(pids, function(pid, next) {
			Favourites.hasVoted(pid, uid, next);
		}, callback);
	};

	Favourites.favourite = function (pid, uid, callback) {
		toggleFavourite('favourite', pid, uid, callback);
	};

	Favourites.unfavourite = function(pid, uid, callback) {
		toggleFavourite('unfavourite', pid, uid, callback);
	};

	function toggleFavourite(type, pid, uid, callback) {
		if (uid === 0) {
			return callback(new Error('[[error:not-logged-in]]'));
		}
		var isFavouriting = type === 'favourite';
		posts.getPostFields(pid, ['pid', 'uid', 'timestamp'], function (err, postData) {
			if (err) {
				return callback(err);
			}

			Favourites.hasFavourited(pid, uid, function (err, hasFavourited) {
				if (err) {
					return callback(err);
				}

				if (isFavouriting && hasFavourited) {
					return callback(new Error('[[error:already-favourited]]'));
				}

				if (!isFavouriting && !hasFavourited) {
					return callback(new Error('[[error:alrady-unfavourited]]'));
				}

				if (isFavouriting) {
					db.sortedSetAdd('uid:' + uid + ':favourites', postData.timestamp, pid);
				} else {
					db.sortedSetRemove('uid:' + uid + ':favourites', pid);
				}


				db[isFavouriting ? 'setAdd' : 'setRemove']('pid:' + pid + ':users_favourited', uid, function(err) {
					if (err) {
						return callback(err);
					}

					db.setCount('pid:' + pid + ':users_favourited', function(err, count) {
						if (err) {
							return callback(err);
						}
						postData.reputation = count;
						posts.setPostField(pid, 'reputation', count, function(err) {
							callback(err, {
								post: postData,
								isFavourited: isFavouriting
							});
						});
					});
				});
			});
		});
	}

	Favourites.hasFavourited = function(pid, uid, callback) {
		db.isSetMember('pid:' + pid + ':users_favourited', uid, callback);
	};

	Favourites.getFavouritesByPostIDs = function(pids, uid, callback) {
		async.map(pids, function(pid, next) {
			Favourites.hasFavourited(pid, uid, next);
		}, callback);
	};

	Favourites.getFavouritedUidsByPids = function(pids, callback) {
		async.map(pids, function(pid, next) {
			db.getSetMembers('pid:' + pid + ':users_favourited', next);
		}, callback);
	};

}(exports));
