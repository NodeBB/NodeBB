var	async = require('async'),
	User = require('./user'),
	Groups = {
		list: function(callback) {
			RDB.hvals('group:gid', function(err, gids) {
				if (gids.length > 0) {
					async.each(gids, function(gid, next) {
						Groups.get(gid, next);
					}, callback);
				} else callback(null, []);
			});
		},
		get: function(gid, options, callback) {
			async.parallel({
				base: function(next) {
					RDB.hgetall('gid:' + gid, next);
				},
				users: function(next) {
					RDB.smembers('gid:' + gid + ':members', function(err, uids) {
						if (options.expand) {
							if (err) return next(err);

							async.map(uids, function(uid, next) {
								User.getUserData(uid, function(data) {
									next(null, data);
								});
							}, function(err, users) {
								next(err, users);
							});
						} else next(err, uids);
					});
				}
			}, function(err, results) {
				if (err) return callback(err);

				results[0].count = results[1].length;
				results[0].users = results[1];

				callback(err, results[0]);
			});
		},
		getGidFromName: function(name, callback) {
			RDB.hget('group:gid', name, callback);
		},
		isMember: function(uid, gid, callback) {
			RDB.sismember('gid:' + gid + ':members', uid, callback);
		},
		exists: function(name, callback) {
			RDB.hexists('group:gid', name, callback);
		},
		create: function(name, description, callback) {
			Groups.exists(name, function(err, exists) {
				if (!exists) {
					RDB.incr('next_gid', function(err, gid) {
						RDB.multi()
							.hset('group:gid', name, gid)
							.hset('gid:' + gid, {
								gid: gid,
								name: name,
								description: description,
								deleted: '0'
							})
						.exec(function(err) {
							callback(err, gid);
						});
					});
				}
			});
		},
		destroy: function(gid, callback) {
			RDB.hset('gid:' + gid, deleted, '1', callback);
		},
		join: function(gid, uid, callback) {
			RDB.sadd('gid:' + gid + ':members', uid, callback);
		},
		leave: function(gid, uid, callback) {
			RDB.srem('gid:' + gid + ':members', uid, callback);
		}
	};

module.exports = Groups;