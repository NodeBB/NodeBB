var RDB = require('./redis.js'),
	posts = require('./posts.js'),
	user = require('./user.js');

(function(Favourites) {

	Favourites.favourite = function(pid, room_id, uid, socket) {
		if (uid === 0) {
			socket.emit('event:alert', {
				alert_id: 'post_favourite',
				title: 'Not Logged In',
				message: 'Please log in in order to favourite this post',
				type: 'danger',
				timeout: 5000
			});
			return;
		}

		posts.getPostFields(pid, ['uid', 'timestamp'], function(postData) {

			Favourites.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited === 0) {
					RDB.sadd('pid:' + pid + ':users_favourited', uid);
					RDB.zadd('uid:' + uid + ':favourites', postData.timestamp, pid);

					RDB.hincrby('post:' + pid, 'reputation', 1);

					if (uid !== postData.uid) {
						user.incrementUserFieldBy(postData.uid, 'reputation', 1, function(err, newreputation) {
							RDB.zadd('users:reputation', newreputation, postData.uid);
						});
					}

					if (room_id) {
						io.sockets. in (room_id).emit('event:rep_up', {
							uid: uid !== postData.uid ? postData.uid : 0,
							pid: pid
						});
					}

					socket.emit('api:posts.favourite', {
						status: 'ok',
						pid: pid
					});
				}
			});
		});
	};

	Favourites.unfavourite = function(pid, room_id, uid, socket) {
		if (uid === 0) {
			socket.emit('event:alert', {
				alert_id: 'post_favourite',
				title: 'Not Logged In',
				message: 'Please log in in order to favourite this post',
				type: 'danger',
				timeout: 5000
			});
			return;
		}

		posts.getPostField(pid, 'uid', function(uid_of_poster) {
			Favourites.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited === 1) {
					RDB.srem('pid:' + pid + ':users_favourited', uid);
					RDB.zrem('uid:' + uid + ':favourites', pid);

					RDB.hincrby('post:' + pid, 'reputation', -1);

					if (uid !== uid_of_poster) {
						user.incrementUserFieldBy(uid_of_poster, 'reputation', -1, function(err, newreputation) {
							RDB.zadd('users:reputation', newreputation, uid_of_poster);
						});
					}

					if (room_id) {
						io.sockets. in (room_id).emit('event:rep_down', {
							uid: uid !== uid_of_poster ? uid_of_poster : 0,
							pid: pid
						});
					}

					socket.emit('api:posts.unfavourite', {
						status: 'ok',
						pid: pid
					});
				}
			});
		});
	};

	Favourites.hasFavourited = function(pid, uid, callback) {
		RDB.sismember('pid:' + pid + ':users_favourited', uid, function(err, hasFavourited) {
			RDB.handle(err);

			callback(hasFavourited);
		});
	};

	Favourites.getFavouritesByPostIDs = function(pids, uid, callback) {
		var loaded = 0;
		var data = {};

		for (var i = 0, ii = pids.length; i < ii; i++) {
			(function(post_id) {
				Favourites.hasFavourited(post_id, uid, function(hasFavourited) {

					data[post_id] = hasFavourited;
					loaded++;
					if (loaded === pids.length)
						callback(data);
				});
			}(pids[i]));
		}
	};

}(exports));