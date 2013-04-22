var RDB = require('./redis.js');

(function(User) {
	var current_uid;

	User.create = function(username, password) {
		if (current_uid) {
			global.socket.emit('user.create', {'status': 0, 'message': 'Only anonymous users can register a new account.'});
			return;
		}

		if (username == null || password == null) {
			global.socket.emit('user.create', {'status': 0, 'message': 'Missing fields'});
			return;
		}


		User.exists(username, function(exists) {
			if (exists) {
				return;
			}

			RDB.incr('global:next_user_id', function(uid) {
				RDB.set('username:' + username + ':uid', uid);
				RDB.set('uid:' + uid + ':username', username);
				RDB.set('uid:' + uid + ':password', password);
				
				RDB.incr('user:count', function(count) {
					io.sockets.emit('user.count', {count: count});
				});

				RDB.lpush('user:users', username);
				io.sockets.emit('user.latest', {username: username});

				global.socket.emit('user.create', {'status': 1});
			});
		});
	};


	User.exists = function(username, callback) {
		User.get_uid_by_username(username, function(exists) {
			exists = !!exists;
			global.socket.emit('user.exists', {exists: exists})

			if (callback) {
				callback(exists);
			}
		});
	};
	User.count = function() {
		RDB.get('user:count', function(count) {
			global.socket.emit('user.count', {count: (count === null) ? 0 : count});
		});
	};
	User.latest = function() {
		RDB.lrange('user:users', 0, 0, function(username) {
			global.socket.emit('user.latest', {username: username});
		});	
	}

	User.get_uid_by_username = function(username, callback) {
		RDB.get('username:' + username + ':uid', callback);
	};


}(exports));