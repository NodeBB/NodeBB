var async = require('async'),

	db = require('./database'),
	posts = require('./posts'),
	user = require('./user'),
	translator = require('./../public/src/translator');

(function (Favourites) {
	"use strict";

	function vote(type, postData, pid, room_id, uid, socket) {
		var	websockets = require('./socket.io');

		if (uid === 0) {
			return socket.emit('event:alert', {
				alert_id: 'post_vote',
				title: '[[vote.not_logged_in.title]]',
				message: '[[vote.not_logged_in.message]]',
				type: 'danger',
				timeout: 5000
			});
		} else if (uid === postData.uid) {
			return socket.emit('event:alert', {
				alert_id: 'post_vote',
				title: '[[vote.cant_vote_self.title]]',
				message: '[[vote.cant_vote_self.message]]',
				type: 'danger',
				timeout: 5000
			});
		}

		//Favourites.hasVoted(type, pid, uid, function (err, hasVoted) {
		//	if (!hasVoted) {
				var notType = (type === 'upvote' ? 'downvote' : 'upvote');

				db[type === 'upvote' ? 'sortedSetAdd' : 'sortedSetRemove']('uid:' + uid + ':upvote', postData.timestamp, pid);
				db[type === 'upvote' ? 'sortedSetRemove' : 'sortedSetAdd']('uid:' + uid + ':downvote', postData.timestamp, pid);


				user[type === 'upvote' ? 'incrementUserFieldBy' : 'decrementUserFieldBy'](postData.uid, 'reputation', 1, function (err, newreputation) {
					db.sortedSetAdd('users:reputation', newreputation, postData.uid);
				});

				db.setAdd('pid:' + pid + ':' + type, uid, function(err) {
					db.setCount('pid:' + pid + ':' + type, function(err, count) {
						posts.setPostField(pid, type, count);
					});
				});

				db.setRemove('pid:' + pid + ':' + notType, uid, function(err) {
					db.setCount('pid:' + pid + ':' + notType, function(err, count) {
						posts.setPostField(pid, notType, count);
					});
				});

				if (room_id) {
					websockets.in(room_id).emit('event:' + (type === 'upvote' ? 'rep_up' : 'rep_down'), {
						uid: postData.uid,
						pid: pid
					});
				}

				socket.emit('posts.' + type, {
					pid: pid
				});
		//	}
		//});
	}

	Favourites.upvote = function(pid, room_id, uid, socket) {
		Favourites.unvote(pid, room_id, uid, socket, function(err, postData) {
			vote('upvote', postData, pid, room_id, uid, socket);
		});
	};

	Favourites.downvote = function(pid, room_id, uid, socket) {
		Favourites.unvote(pid, room_id, uid, socket, function(err, postData) {
			vote('downvote', postData, pid, room_id, uid, socket);
		});
	};

	Favourites.unvote = function(pid, room_id, uid, socket, callback) {
		var	websockets = require('./socket.io');

		Favourites.hasVoted(pid, uid, function(err, voteStatus) {
			posts.getPostFields(pid, ['uid', 'timestamp'], function (err, postData) {
				if (voteStatus === 'upvoted') {
					db.sortedSetRemove('uid:' + uid + ':upvote');

					db.setRemove('pid:' + pid + ':upvote', uid, function(err) {
						db.setCount('pid:' + pid + ':upvote', function(err, count) {
							posts.setPostField(pid, 'upvote', count);
						});
					});

					user.decrementUserFieldBy(postData.uid, 'reputation', 1, function (err, newreputation) {
						db.sortedSetAdd('users:reputation', newreputation, postData.uid);
					});

					if (room_id) {
						websockets.in(room_id).emit('event:rep_down', {
							uid: postData.uid,
							pid: pid
						});
					}
				} else if (voteStatus === 'downvoted') {
					db.sortedSetRemove('uid:' + uid + ':downvote');

					db.setRemove('pid:' + pid + ':downvote', uid, function(err) {
						db.setCount('pid:' + pid + ':downvote', function(err, count) {
							posts.setPostField(pid, 'downvote', count);
						});
					});

					user.incrementUserFieldBy(postData.uid, 'reputation', 1, function (err, newreputation) {
						db.sortedSetAdd('users:reputation', newreputation, postData.uid);
					});

					if (room_id) {
						websockets.in(room_id).emit('event:rep_up', {
							uid: postData.uid,
							pid: pid
						});
					}
				}

				if (voteStatus) {
					socket.emit('posts.unvote', {
						pid: pid
					});
				}

				if (callback) {
					callback(err, postData);
				}
			});
		});

	};

	Favourites.hasVoted = function(pid, uid, callback) {
		async.parallel({
			upvoted: function(each) {
				db.isSetMember('pid:' + pid + ':upvote', uid, each);
			},
			downvoted: function(each) {
				db.isSetMember('pid:' + pid + ':downvote', uid, each);
			}
		}, function(err, results) {
			var voteStatus = "";

			if (results.upvoted) {
				voteStatus = "upvoted";
			} else if (results.downvoted) {
				voteStatus = "downvoted";
			}

			callback(err, voteStatus)
		});
	};

	Favourites.favourite = function (pid, room_id, uid, socket) {
		var	websockets = require('./socket.io');

		if (uid === 0) {
			translator.mget(['topic:favourites.not_logged_in.message', 'topic:favourites.not_logged_in.title'], function(err, results) {
				socket.emit('event:alert', {
					alert_id: 'post_favourite',
					title: results[1],
					message: results[0],
					type: 'danger',
					timeout: 5000
				});
			});
			return;
		}

		posts.getPostFields(pid, ['uid', 'timestamp'], function (err, postData) {
			Favourites.hasFavourited(pid, uid, function (err, hasFavourited) {
				if (!hasFavourited) {
					db.sortedSetAdd('uid:' + uid + ':favourites', postData.timestamp, pid);
					db.setAdd('pid:' + pid + ':users_favourited', uid, function(err) {
						db.setCount('pid:' + pid + ':users_favourited', function(err, count) {
							posts.setPostField(pid, 'favourited', count);
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
							posts.setPostField(pid, 'favourited', count);
						});
					});

					if (room_id) {
						websockets.in(room_id).emit('event:unfavourited', {
							uid: uid !== uid_of_poster ? uid_of_poster : 0,
							pid: pid
						});
					}

					socket.emit('posts.unfavourite', {
						pid: pid
					});
				}
			});
		});
	};

	Favourites.hasFavourited = function(pid, uid, callback) {
		db.isSetMember('pid:' + pid + ':users_favourited', uid, callback);
	};

	Favourites.getFavouritesByPostIDs = function(pids, uid, callback) {
		var data = {};

		function iterator(pid, next) {
			Favourites.hasFavourited(pid, uid, function(err, hasFavourited) {
				data[pid] = hasFavourited;
				next()
			});
		}

		async.each(pids, iterator, function(err) {
			callback(data);
		});
	};

	Favourites.getFavouritedUidsByPids = function(pids, callback) {
		var data = {};

		function getUids(pid, next) {
			db.getSetMembers('pid:' + pid + ':users_favourited', function(err, uids) {
				data[pid] = uids;
				next();
			});
		}

		async.each(pids, getUids, function(err) {
			callback(data);
		});
	};

}(exports));