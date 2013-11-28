(function(Groups) {
	"use strict";

	var async = require('async'),
		User = require('./user'),
		RDB = RDB || require('./redis');

	Groups.list = function(options, callback) {
		RDB.hvals('group:gid', function (err, gids) {
			if (gids.length > 0) {
				async.map(gids, function (gid, next) {
					Groups.get(gid, {
						expand: options.expand
					}, next);
				}, function (err, groups) {
					callback(err, groups.filter(function (group) {
						if (group.deleted === '1') {
							return false;
						} else {
							return true;
						}
					}));
				});
			} else {
				callback(null, []);
			}
		});
	};

	Groups.get = function(gid, options, callback) {
		async.parallel({
			base: function (next) {
				RDB.hgetall('gid:' + gid, next);
			},
			users: function (next) {
				RDB.smembers('gid:' + gid + ':members', function (err, uids) {
					if (options.expand) {
						if (err) {
							return next(err);
						}

						async.map(uids, function (uid, next) {
							User.getUserData(uid, next);
						}, function (err, users) {
							next(err, users);
						});
					} else {
						next(err, uids);
					}
				});
			}
		}, function (err, results) {
			if (err) {
				return callback(err);
			}

			results.base.count = results.users.length;
			results.base.members = results.users;

			results.base.deletable = (results.base.gid !== '1');

			callback(err, results.base);
		});
	};

	Groups.getByGroupName = function(groupName, options, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.get(gid, options, callback);
			}
		});
	};

	Groups.isDeleted = function(gid, callback) {
		RDB.hget('gid:' + gid, 'deleted', function(err, deleted) {
			callback(err, deleted === '1');
		});
	};

	Groups.getGidFromName = function(name, callback) {
		RDB.hget('group:gid', name, callback);
	};

	Groups.isMember = function(uid, gid, callback) {
		Groups.isDeleted(gid, function(err, deleted) {
			if (!deleted) {
				RDB.sismember('gid:' + gid + ':members', uid, callback);
			} else {
				callback(err, false);
			}
		});
	};

	Groups.isMemberByGroupName = function(uid, groupName, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(null, false);
			} else {
				Groups.isMember(uid, gid, function(err, isMember) {
					callback(err, !!isMember);
				});
			}
		});
	};

	Groups.isEmpty = function(gid, callback) {
		RDB.scard('gid:' + gid + ':members', function(err, numMembers) {
			callback(err, numMembers === 0);
		});
	};

	Groups.isEmptyByGroupName = function(groupName, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.isEmpty(gid, callback);
			}
		});
	};

	Groups.exists = function(name, callback) {
		async.parallel({
			exists: function(next) {
				RDB.hexists('group:gid', name, next);
			},
			deleted: function(next) {
				Groups.getGidFromName(name, function(err, gid) {
					Groups.isDeleted(gid, next);
				});
			}
		}, function(err, results) {
			callback(err, !results ? null : (results.exists && !results.deleted));
		});
	};

	Groups.create = function(name, description, callback) {
		if (name.length === 0) {
			return callback(new Error('name-too-short'));
		}

		Groups.exists(name, function (err, exists) {
			if (!exists) {
				RDB.incr('next_gid', function (err, gid) {
					RDB.multi()
						.hset('group:gid', name, gid)
						.hmset('gid:' + gid, {
							gid: gid,
							name: name,
							description: description,
							deleted: '0',
							hidden: '0'
						})
						.exec(function (err) {
							Groups.get(gid, {}, callback);
						});
				});
			} else {
				callback(new Error('group-exists'));
			}
		});
	};

	Groups.hide = function(gid) {
		Groups.exists(gid, function(err, exists) {
			if (exists) {
				Groups.update(gid, {
					hidden: '1'
				});
			}
		});
	};

	Groups.update = function(gid, values, callback) {
		RDB.exists('gid:' + gid, function (err, exists) {
			if (!err && exists) {
				RDB.hmset('gid:' + gid, values, callback);
			} else {
				callback(new Error('gid-not-found'));
			}
		});
	};

	Groups.destroy = function(gid, callback) {
		if (gid !== 1) {
			RDB.hset('gid:' + gid, 'deleted', '1', callback);
		}
	};

	Groups.join = function(gid, uid, callback) {
		RDB.sadd('gid:' + gid + ':members', uid, callback);
	};

	Groups.joinByGroupName = function(groupName, uid, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				Groups.create(groupName, '', function(err, groupObj) {
					Groups.hide(groupObj.gid);
					Groups.join(groupObj.gid, uid, callback);
				});
			} else {
				Groups.join(gid, uid, callback);
			}
		});
	};

	Groups.leave = function(gid, uid, callback) {
		RDB.srem('gid:' + gid + ':members', uid, callback);
	};

	Groups.leaveByGroupName = function(groupName, uid, callback) {
		Groups.getGidFromName(groupName, function(err, gid) {
			if (err || !gid) {
				callback(new Error('gid-not-found'));
			} else {
				Groups.leave(gid, uid, callback);
			}
		});
	};
	
}(module.exports));
