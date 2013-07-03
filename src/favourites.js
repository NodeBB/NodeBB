var	RDB = require('./redis.js'),
	user = require('./user.js');

(function(Favourites) {

	Favourites.favourite = function(pid, room_id, uid, socket) {
		if (uid === 0) {
			socket.emit('event:alert', {
				alert_id: 'post_favourite',
				title: 'Not Logged In',
				message: 'Please log in in order to favourite this post',
				type: 'error',
				timeout: 5000
			});

			socket.emit('api:posts.favourite', {
				status: 'error',
				pid: pid
			});
			return;
		}

		RDB.get('pid:' + pid + ':uid', function(err, uid_of_poster) {
			RDB.handle(err);

			Favourites.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited == false) {
					RDB.sadd('pid:' + pid + ':users_favourited', uid);
					RDB.incr('pid:' + pid + ':rep');

					if (uid !== uid_of_poster) user.incrementUserFieldBy(uid_of_poster, 'reputation', 1);

					if (room_id) {
						io.sockets.in(room_id).emit('event:rep_up', {uid: uid !== uid_of_poster ? uid_of_poster : 0, pid: pid});
					}

					socket.emit('api:posts.favourite', {
						status: 'ok'
					});
				}
			});
		});
	}

	Favourites.unfavourite = function(pid, room_id, uid, socket) {
		if (uid === 0) {
			socket.emit('event:alert', {
				alert_id: 'post_favourite',
				title: 'Not Logged In',
				message: 'Please log in in order to favourite this post',
				type: 'error',
				timeout: 5000
			});
			return;
		}

		RDB.get('pid:' + pid + ':uid', function(err, uid_of_poster) {
			RDB.handle(err);

			Favourites.hasFavourited(pid, uid, function(hasFavourited) {
				if (hasFavourited == true) {
					
					RDB.srem('pid:' + pid + ':users_favourited', uid);
					RDB.decr('pid:' + pid + ':rep');
					
					if (uid !== uid_of_poster) user.incrementUserFieldBy(uid_of_poster, 'reputation', -1);

					if (room_id) {
						io.sockets.in(room_id).emit('event:rep_down', {uid: uid !== uid_of_poster ? uid_of_poster : 0, pid: pid});
					}
				}
			});
		});
	}

	Favourites.hasFavourited = function(pid, uid, callback) {
		RDB.sismember('pid:' + pid + ':users_favourited', uid, function(err, hasFavourited) {
			RDB.handle(err);
			
			callback(hasFavourited);
		});
	}

	Favourites.getFavouritesByPostIDs = function(pids, uid, callback) {
		var loaded = 0;
		var data = {};

		for (var i=0, ii=pids.length; i<ii; i++) {
			(function(post_id) {
				Favourites.hasFavourited(post_id, uid, function(hasFavourited) {
			
					data[post_id] = hasFavourited;
					loaded ++;
					if (loaded === pids.length) 
						callback(data);
				});
			}(pids[i]));
		}
	}

}(exports));