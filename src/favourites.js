"use strict";

var async = require('async');
var db = require('./database');
var posts = require('./posts');
var user = require('./user');
var plugins = require('./plugins');
var meta = require('./meta');

(function (Favourites) {

	var votesInProgress = {};

	function vote(type, unvote, pid, uid, callback) {
		uid = parseInt(uid, 10);

		if (uid === 0) {
			return callback(new Error('[[error:not-logged-in]]'));
		}

		posts.getPostFields(pid, ['pid', 'uid', 'tid'], function (err, postData) {
			if (err) {
				return callback(err);
			}

			var now = Date.now();

			if (type === 'upvote' && !unvote) {
				db.sortedSetAdd('uid:' + uid + ':upvote', now, pid);
			} else {
				db.sortedSetRemove('uid:' + uid + ':upvote', pid);
			}

			if (type === 'upvote' || unvote) {
				db.sortedSetRemove('uid:' + uid + ':downvote', pid);
			} else {
				db.sortedSetAdd('uid:' + uid + ':downvote', now, pid);
			}

			user[type === 'upvote' ? 'incrementUserFieldBy' : 'decrementUserFieldBy'](postData.uid, 'reputation', 1, function (err, newreputation) {
				if (err) {
					return callback(err);
				}

				if (parseInt(postData.uid, 10)) {
					db.sortedSetAdd('users:reputation', newreputation, postData.uid);
				}

				adjustPostVotes(postData, uid, type, unvote, function(err, votes) {
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

	function adjustPostVotes(postData, uid, type, unvote, callback) {
		var notType = (type === 'upvote' ? 'downvote' : 'upvote');

		async.series([
			function(next) {
				if (unvote) {
					db.setRemove('pid:' + postData.pid + ':' + type, uid, next);
				} else {
					db.setAdd('pid:' + postData.pid + ':' + type, uid, next);
				}
			},
			function(next) {
				db.setRemove('pid:' + postData.pid + ':' + notType, uid, next);
			}
		], function(err) {
			if (err) {
				return callback(err);
			}

			async.parallel({
				upvotes: function(next) {
					db.setCount('pid:' + postData.pid + ':upvote', next);
				},
				downvotes: function(next) {
					db.setCount('pid:' + postData.pid + ':downvote', next);
				}
			}, function(err, results) {
				if (err) {
					return callback(err);
				}
				var voteCount = parseInt(results.upvotes, 10) - parseInt(results.downvotes, 10);

				posts.updatePostVoteCount(postData, voteCount, function(err) {
					callback(err, voteCount);
				});
			});
		});
	}

	Favourites.upvote = function(pid, uid, callback) {
		if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
			return callback(new Error('[[error:reputation-system-disabled]]'));
		}

		if (voteInProgress(pid, uid)) {
			return callback(new Error('[[error:already-voting-for-this-post]]'));
		}

		putVoteInProgress(pid, uid);

		toggleVote('upvote', pid, uid, function(err, data) {
			clearVoteProgress(pid, uid);
			callback(err, data);
		});
	};

	Favourites.downvote = function(pid, uid, callback) {
		if (parseInt(meta.config['reputation:disabled'], 10) === 1) {
			return callback(new Error('[[error:reputation-system-disabled]]'));
		}

		if (parseInt(meta.config['downvote:disabled'], 10) === 1) {
			return callback(new Error('[[error:downvoting-disabled]]'));
		}

		if (voteInProgress(pid, uid)) {
			return callback(new Error('[[error:already-voting-for-this-post]]'));
		}

		putVoteInProgress(pid, uid);

		toggleVote('downvote', pid, uid, function(err, data) {
			clearVoteProgress(pid, uid);
			callback(err, data);
		});
	};

	Favourites.unvote = function(pid, uid, callback) {
		if (voteInProgress(pid, uid)) {
			return callback(new Error('[[error:already-voting-for-this-post]]'));
		}

		putVoteInProgress(pid, uid);

		unvote(pid, uid, 'unvote', function(err, data) {
			clearVoteProgress(pid, uid);
			callback(err, data);
		});
	};

	function voteInProgress(pid, uid) {
		return Array.isArray(votesInProgress[uid]) && votesInProgress[uid].indexOf(parseInt(pid, 10)) !== -1;
	}

	function putVoteInProgress(pid, uid) {
		votesInProgress[uid] = votesInProgress[uid] || [];
		votesInProgress[uid].push(parseInt(pid, 10));
	}

	function clearVoteProgress(pid, uid) {
		if (Array.isArray(votesInProgress[uid])) {
			var index = votesInProgress[uid].indexOf(parseInt(pid, 10));
			if (index !== -1) {
				votesInProgress[uid].splice(index, 1);
			}
		}
	}

	function toggleVote(type, pid, uid, callback) {
		unvote(pid, uid, type, function(err) {
			if (err) {
				return callback(err);
			}

			vote(type, false, pid, uid, callback);
		});
	}

	function unvote(pid, uid, command, callback) {
		async.parallel({
			owner: function(next) {
				posts.getPostField(pid, 'uid', next);
			},
			voteStatus: function(next) {
				Favourites.hasVoted(pid, uid, next);
			},
			reputation: function(next) {
				user.getUserField(uid, 'reputation', next);
			}
		}, function(err, results) {
			if (err) {
				return callback(err);
			}

			if (parseInt(uid, 10) === parseInt(results.owner, 10)) {
				return callback(new Error('self-vote'));
			}

			if (command === 'downvote' && parseInt(results.reputation) < parseInt(meta.config['privileges:downvote'], 10)) {
				return callback(new Error('[[error:not-enough-reputation-to-downvote]]'));
			}

			var voteStatus = results.voteStatus,
				hook,
				current = voteStatus.upvoted ? 'upvote' : 'downvote';

			if (voteStatus.upvoted && command === 'downvote' || voteStatus.downvoted && command === 'upvote') {	// e.g. User *has* upvoted, and clicks downvote
				hook = command;
			} else if (voteStatus.upvoted || voteStatus.downvoted) {	// e.g. User *has* upvoted, clicks upvote (so we "unvote")
				hook = 'unvote';
			} else {	// e.g. User *has not* voted, clicks upvote
				hook = command;
				current = 'unvote';
			}

			plugins.fireHook('action:post.' + hook, {
				pid: pid,
				uid: uid,
				owner: results.owner,
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
			owner: function(next) {
				posts.getPostField(pid, 'uid', next);
			},
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
				return callback(new Error('[[error:already-unfavourited]]'));
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
				}
			], function(err) {
				if (err) {
					return callback(err);
				}

				var current = results.hasFavourited ? 'favourited' : 'unfavourited';

				plugins.fireHook('action:post.' + type, {
					pid: pid,
					uid: uid,
					owner: results.owner,
					current: current
				});

				callback(null, {
					post: results.postData,
					isFavourited: isFavouriting
				});
			});
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
