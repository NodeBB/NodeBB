var async = require('async'),

	db = require('./database'),
	posts = require('./posts'),
	user = require('./user'),
	translator = require('./../public/src/translator');

(function (Favourites) {
	"use strict";

	function vote(type, unvote, pid, room_id, uid, socket, callback) {
		var	websockets = require('./socket.io');

		if (uid === 0) {
			return socket.emit('event:alert', {
				alert_id: 'post_vote',
				title: '[[topic:vote.not_logged_in.title]]',
				message: '[[topic:vote.not_logged_in.message]]',
				type: 'danger',
				timeout: 5000
			});
		}

		posts.getPostFields(pid, ['uid', 'timestamp'], function (err, postData) {
			if (uid === parseInt(postData.uid, 10)) {
				socket.emit('event:alert', {
					alert_id: 'post_vote',
					title: '[[topic:vote.cant_vote_self.title]]',
					message: '[[topic:vote.cant_vote_self.message]]',
					type: 'danger',
					timeout: 5000
				});

				if (callback) {
					callback(false);
				}

				return false;
			}

			if(type === 'upvote' || !unvote) {
				db.sortedSetAdd('uid: ' + uid + ':upvote', postData.timestamp, pid);
			} else {
				db.sortedSetRemove('uid: ' + uid + ':upvote', pid);
			}

			if(type === 'upvote' || unvote) {
				db.sortedSetRemove('uid: ' + uid + ':downvote', pid);
			} else {
				db.sortedSetAdd('uid: ' + uid + ':downvote', postData.timestamp, pid);
			}

			user[type === 'upvote' ? 'incrementUserFieldBy' : 'decrementUserFieldBy'](postData.uid, 'reputation', 1, function (err, newreputation) {
				db.sortedSetAdd('users:reputation', newreputation, postData.uid);
			});

			if (room_id) {
				websockets.in(room_id).emit('event:' + (type === 'upvote' ? 'rep_up' : 'rep_down'), {
					uid: postData.uid,
					pid: pid
				});
			}

			socket.emit('posts.' + (unvote ? 'unvote' : type), {
				pid: pid
			});

			adjustPostVotes(pid, uid, type, unvote, function() {
				if (callback) {
					callback();
				}
			});
		});
	}

	function adjustPostVotes(pid, uid, type, unvote, callback) {
		var notType = (type === 'upvote' ? 'downvote' : 'upvote');

		async.series([
			function(next) {
				if (unvote) {
					db.setRemove('pid:' + pid + ':' + type, uid, function(err) {
						next(err);
					});
				} else {
					db.setAdd('pid:' + pid + ':' + type, uid, function(err) {
						next(err);
					});
				}
			},
			function(next) {
				db.setRemove('pid:' + pid + ':' + notType, uid, function(err) {
					next(err);
				});
			}
		], function(err) {
			async.parallel({
				upvotes: function(next) {
					db.setCount('pid:' + pid + ':upvote', next);
				},
				downvotes: function(next) {
					db.setCount('pid:' + pid + ':downvote', next);
				}
			}, function(err, results) {
				posts.setPostField(pid, 'votes', parseInt(results.upvotes, 10) - parseInt(results.downvotes, 10));
			});

			if (callback) {
				callback();
			}
		});
	}

	Favourites.upvote = function(pid, room_id, uid, socket) {
		toggleVote('upvote', pid, room_id, uid, socket);
	};

	Favourites.downvote = function(pid, room_id, uid, socket) {
		toggleVote('downvote', pid, room_id, uid, socket);
	};

	function toggleVote(type, pid, room_id, uid, socket) {
		Favourites.unvote(pid, room_id, uid, socket, function(err) {
			vote(type, false, pid, room_id, uid, socket);
		});
	}

	Favourites.unvote = function(pid, room_id, uid, socket, callback) {
		var	websockets = require('./socket.io');

		Favourites.hasVoted(pid, uid, function(err, voteStatus) {
			if (voteStatus.upvoted || voteStatus.downvoted) {
				socket.emit('posts.unvote', {
					pid: pid
				});

				return vote(voteStatus.upvoted ? 'downvote' : 'upvote', true, pid, room_id, uid, socket, function() {
					if (callback) {
						callback(err);
					}
				});
			}

			if (callback) {
				callback(err);
			}
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

	Favourites.favourite = function (pid, room_id, uid, socket) {
		var	websockets = require('./socket.io');

		if (uid === 0) {
			return socket.emit('event:alert', {
				alert_id: 'post_favourite',
				title: '[[topic:favourites.not_logged_in.title]]',
				message: '[[topic:favourites.not_logged_in.message]]',
				type: 'danger',
				timeout: 5000
			});
		}

		posts.getPostFields(pid, ['uid', 'timestamp'], function (err, postData) {
			Favourites.hasFavourited(pid, uid, function (err, hasFavourited) {
				if (!hasFavourited) {
					db.sortedSetAdd('uid:' + uid + ':favourites', postData.timestamp, pid);
					db.setAdd('pid:' + pid + ':users_favourited', uid, function(err) {
						db.setCount('pid:' + pid + ':users_favourited', function(err, count) {
							posts.setPostField(pid, 'reputation', count);
						});
					});

					if (room_id) {
						websockets.in(room_id).emit('event:favourited', {
							uid: uid !== postData.uid ? postData.uid : 0,
							pid: pid
						});
					}

					socket.emit('posts.favourite', {
						pid: pid
					});
				}
			});
		});
	};

	Favourites.unfavourite = function(pid, room_id, uid, socket) {
		var	websockets = require('./socket.io');

		if (uid === 0) {
			return;
		}

		posts.getPostField(pid, 'uid', function (err, uid_of_poster) {
			Favourites.hasFavourited(pid, uid, function (err, hasFavourited) {
				if (hasFavourited) {
					db.sortedSetRemove('uid:' + uid + ':favourites', pid);
					db.setRemove('pid:' + pid + ':users_favourited', uid, function(err) {
						db.setCount('pid:' + pid + ':users_favourited', function(err, count) {
							posts.setPostField(pid, 'reputation', count);
						});
					});

					if (room_id) {
						websockets.in(room_id).emit('event:unfavourited', {
							uid: uid !== uid_of_poster ? uid_of_poster : 0,
							pid: pid
						});
					}

					if (socket) {
						socket.emit('posts.unfavourite', {
							pid: pid
						});
					}
				}
			});
		});
	};

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