"use strict";

var async = require('async'),
	winston = require('winston'),
	db = require('./database'),
	posts = require('./posts'),
	user = require('./user'),
	plugins = require('./plugins'),
	meta = require('./meta');

(function (Favourites) {

	function vote(type, unvote, pid, uid, callback) {
		uid = parseInt(uid, 10);

		if (uid === 0) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		posts.getPostFields(pid, ['pid', 'uid'], function (err, postData) {
			if (err) {
				return callback(err);
			}

			var now = Date.now();

			if(type === 'upvote' && !unvote) {
				db.sortedSetAdd('uid:' + uid + ':upvote', now, pid);
			} else {
				db.sortedSetRemove('uid:' + uid + ':upvote', pid);
			}

			if(type === 'upvote' || unvote) {
				db.sortedSetRemove('uid:' + uid + ':downvote', pid);
			} else {
				db.sortedSetAdd('uid:' + uid + ':downvote', now, pid);
			}

			user[type === 'upvote' ? 'incrementUserFieldBy' : 'decrementUserFieldBy'](postData.uid, 'reputation', 1, function (err, newreputation) {
				if (err) {
					return callback(err);
				}

				db.sortedSetAdd('users:reputation', newreputation, postData.uid);

				if (type === 'downvote') {
					banUserForLowReputation(postData.uid, newreputation);
				}

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

	function banUserForLowReputation(uid, newreputation) {
		if (parseInt(meta.config['autoban:downvote'], 10) === 1 && newreputation < parseInt(meta.config['autoban:downvote:threshold'], 10)) {
			user.getUserField(uid, 'banned', function(err, banned) {
				if (err || parseInt(banned, 10) === 1) {
					return;
				}
				var adminUser = require('./socket.io/admin/user');
				adminUser.banUser(uid, function(err) {
					if (err) {
						return winston.error(err.message);
					}
					winston.info('uid ' + uid + ' was banned for reaching ' + newreputation + ' reputation');
				});
			});
		}
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

				posts.updatePostVoteCount(pid, voteCount, function(err) {
					callback(err, voteCount);
				});
			});
		});
	}

	Favourites.upvote = function(pid, uid, callback) {
		if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
			return callback(new Error('[[error:reputation-system-disabled]]'));
		}

		toggleVote('upvote', pid, uid, callback);
	};

	Favourites.downvote = function(pid, uid, callback) {
		if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
			return callback(new Error('[[error:reputation-system-disabled]]'));
		}

		if (parseInt(meta.config['downvote:disabled'], 10) === 1) {
			return callback(new Error('[[error:downvoting-disabled]]'));
		}

		user.getUserField(uid, 'reputation', function(err, reputation) {
			if (err) {
				return callback(err);
			}

			if (reputation < parseInt(meta.config['privileges:downvote'], 10)) {
				return callback(new Error('[[error:not-enough-reputation-to-downvote]]'));
			}

			toggleVote('downvote', pid, uid, callback);
		});
	};

	function toggleVote(type, pid, uid, callback) {
		unvote(pid, uid, type, function(err) {
			if (err) {
				return callback(err);
			}

			vote(type, false, pid, uid, callback);
		});
	}

	Favourites.unvote = function(pid, uid, callback) {
		unvote(pid, uid, 'unvote', callback);
	};

	function unvote(pid, uid, command, callback) {
		async.parallel({
			owner: function(next) {
				posts.getPostField(pid, 'uid', next);
			},
			voteStatus: function(next) {
				Favourites.hasVoted(pid, uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (parseInt(uid, 10) === parseInt(results.owner, 10)) {
				return callback(new Error('[[error:cant-vote-self-post]]'));
			}

			var voteStatus = results.voteStatus,
				hook,
				current = voteStatus.upvoted ? 'upvote' : 'downvote';

			if (voteStatus.upvoted && command === 'downvote' || voteStatus.downvoted && command === 'upvote') {
				hook = command;
			} else if (voteStatus.upvoted || voteStatus.downvoted) {
				hook = 'unvote';
			} else {
				hook = command;
				current = 'unvote';
			}

			plugins.fireHook('action:post.' + hook, {
				pid: pid,
				uid: uid,
				current: current
			});

			if (!voteStatus || (!voteStatus.upvoted && !voteStatus.downvoted)) {
				return callback();
			}

			vote(voteStatus.upvoted ? 'downvote' : 'upvote', true, pid, uid, callback);
		});
	}

	Favourites.hasVoted = function(pid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, {upvoted: false, downvoted: false});
		}

		db.isMemberOfSets(['pid:' + pid + ':upvote', 'pid:' + pid + ':downvote'], uid, function(err, hasVoted) {
			if (err) {
				return callback(err);
			}

			callback (null, {upvoted: hasVoted[0], downvoted: hasVoted[1]});
		});
	};

	Favourites.getVoteStatusByPostIDs = function(pids, uid, callback) {
		if (!parseInt(uid, 10)) {
			var data = pids.map(function() {return false;});
			return callback(null, {upvotes: data, downvotes: data});
		}
		var upvoteSets = [],
			downvoteSets = [];

		for (var i=0; i<pids.length; ++i) {
			upvoteSets.push('pid:' + pids[i] + ':upvote');
			downvoteSets.push('pid:' + pids[i] + ':downvote');
		}

		async.parallel({
			upvotes: function(next) {
				db.isMemberOfSets(upvoteSets, uid, next);
			},
			downvotes: function(next) {
				db.isMemberOfSets(downvoteSets, uid, next);
			}
		}, callback);
	};

	Favourites.favourite = function (pid, uid, callback) {
		toggleFavourite('favourite', pid, uid, callback);
	};

	Favourites.unfavourite = function(pid, uid, callback) {
		toggleFavourite('unfavourite', pid, uid, callback);
	};

	function toggleFavourite(type, pid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(new Error('[[error:not-logged-in]]'));
		}
		var isFavouriting = type === 'favourite';

		async.parallel({
			postData: function(next) {
				posts.getPostFields(pid, ['pid', 'uid'], next);
			},
			hasFavourited: function(next) {
				Favourites.hasFavourited(pid, uid, next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (isFavouriting && results.hasFavourited) {
				return callback(new Error('[[error:already-favourited]]'));
			}

			if (!isFavouriting && !results.hasFavourited) {
				return callback(new Error('[[error:alrady-unfavourited]]'));
			}

			async.waterfall([
				function(next) {
					if (isFavouriting) {
						db.sortedSetAdd('uid:' + uid + ':favourites', Date.now(), pid, next);
					} else {
						db.sortedSetRemove('uid:' + uid + ':favourites', pid, next);
					}
				},
				function(next) {
					db[isFavouriting ? 'setAdd' : 'setRemove']('pid:' + pid + ':users_favourited', uid, next);
				},
				function(next) {
					db.setCount('pid:' + pid + ':users_favourited', next);
				},
				function(count, next) {
					results.postData.reputation = count;
					posts.setPostField(pid, 'reputation', count, next);
				},
				function(next) {
					next(null, {
						post: results.postData,
						isFavourited: isFavouriting
					});
				}
			], callback);
		});
	}

	Favourites.hasFavourited = function(pid, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, false);
		}
		db.isSetMember('pid:' + pid + ':users_favourited', uid, callback);
	};

	Favourites.getFavouritesByPostIDs = function(pids, uid, callback) {
		if (!parseInt(uid, 10)) {
			return callback(null, pids.map(function() {return false;}));
		}

		var sets = [];
		for (var i=0; i<pids.length; ++i) {
			sets.push('pid:' + pids[i] + ':users_favourited');
		}

		db.isMemberOfSets(sets, uid, callback);
	};

	Favourites.getUpvotedUidsByPids = function(pids, callback) {
		var sets = pids.map(function(pid) {
			return 'pid:' + pid + ':upvote';
		});
		db.getSetsMembers(sets, callback);
	};


}(exports));
