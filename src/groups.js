var async = require('async'),
	User = require('./user'),
	RDB = RDB || require('./redis'),
	Groups = {
		list: function(options, callback) {
			RDB.hvals('group:gid', function(err, gids) {
				if (gids.length > 0) {
					async.map(gids, function(gid, next) {
						Groups.get(gid, {
							expand: options.expand
						}, next);
					}, function(err, groups) {
						callback(err, groups.filter(function(group) {
							if (group.deleted === '1') return false;
							else return true;
						}));
					});
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
								User.getUserData(uid, next);
							}, function(err, users) {
								next(err, users);
							});
						} else next(err, uids);
					});
				}
			}, function(err, results) {
				if (err) return callback(err);

				results.base.count = results.users.length;
				results.base.members = results.users;

				callback(err, results.base);
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
			if (name.length === 0) return callback(new Error('name-too-short'));

			Groups.exists(name, function(err, exists) {
				if (!exists) {
					RDB.incr('next_gid', function(err, gid) {
						RDB.multi()
							.hset('group:gid', name, gid)
							.hmset('gid:' + gid, {
								gid: gid,
								name: name,
								description: description,
								deleted: '0'
							})
							.exec(function(err) {
								Groups.get(gid, {}, callback);
							});
					});
				} else callback(new Error('group-exists'))
			});
		},
		update: function(gid, values, callback) {
			RDB.exists('gid:' + gid, function(err, exists) {
				if (!err && exists) RDB.hmset('gid:' + gid, values, callback);
				else calback(new Error('gid-not-found'));
			});
		},
		destroy: function(gid, callback) {
			RDB.hset('gid:' + gid, 'deleted', '1', callback);
		},
		join: function(gid, uid, callback) {
			RDB.sadd('gid:' + gid + ':members', uid, callback);
		},
		leave: function(gid, uid, callback) {
			RDB.srem('gid:' + gid + ':members', uid, callback);
		}
	};

module.exports = Groups;