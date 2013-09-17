var RDB = require('./redis.js'),
	async = require('async'),
	winston = require('winston'),
	user = require('./user'),
	Groups = require('./groups');


function upgradeCategory(cid, callback) {
	RDB.type('categories:' + cid + ':tid', function(err, type) {
		if (type === 'set') {
			RDB.smembers('categories:' + cid + ':tid', function(err, tids) {

				function moveTopic(tid, callback) {
					RDB.hget('topic:' + tid, 'timestamp', function(err, timestamp) {
						if (err)
							return callback(err);

						RDB.zadd('temp_categories:' + cid + ':tid', timestamp, tid);
						callback(null);
					});
				}

				async.each(tids, moveTopic, function(err) {
					if (!err) {
						RDB.rename('temp_categories:' + cid + ':tid', 'categories:' + cid + ':tid');
						callback(null);
					} else
						callback(err);
				});

			});
		} else {
			winston.info('category already upgraded ' + cid);
			callback(null);
		}
	});
}

function upgradeUser(uid, callback) {
	user.getUserFields(uid, ['joindate', 'postcount', 'reputation'], function(err, userData) {
		if (err)
			return callback(err);

		async.parallel([
			function(next) {
				if (userData.joindate)
					RDB.zadd('users:joindate', userData.joindate, uid, next);
				else
					next(null);
			},
			function(next) {
				if (userData.postcount)
					RDB.zadd('users:postcount', userData.postcount, uid, next);
				else
					next(null);
			},
			function(next) {
				if (userData.reputation)
					RDB.zadd('users:reputation', userData.reputation, uid, next);
				else
					next(null);
			}
		], function(err, result) {
			callback(err);
		});
	});
}

function upgradeUserHash(uid, callback) {
	user.getUserFields(uid, ['username', 'userslug', 'email'], function(err, userData) {
		if (err)
			return callback(err);

		async.parallel([
			function(next) {
				if (userData.username)
					RDB.hset('username:uid', userData.username, uid, next);
				else
					next(null);
			},
			function(next) {
				if (userData.userslug)
					RDB.hset('userslug:uid', userData.userslug, uid, next);
				else
					next(null);
			},
			function(next) {
				if (userData.email)
					RDB.hset('email:uid', userData.email, uid, next);
				else
					next(null);
			}

		], function(err, result) {
			callback(err);
		});
	});
}

function upgradeAdmins(callback) {
	Groups.getGidFromName('Administrators', function(err, gid) {
		if (!err && !gid) {
			winston.info('Upgading Administrators');

			async.parallel([
				function(next) {
					RDB.smembers("administrators", next);
				},
				function(next) {
					Groups.create('Administrators', 'Forum Administrators', next);
				}
			], function(err, results) {
				var gid = results[1].gid;

				async.each(results[0], function(uid, next) {
					Groups.join(gid, uid, next);
				}, callback);
			});
		} else {
			winston.info('Administrators group OK')
			callback();
		}
	});
}

exports.upgrade = function() {

	winston.info('upgrading nodebb now');

	var schema = [
		function upgradeCategories(next) {
			winston.info('upgrading categories');

			RDB.lrange('categories:cid', 0, -1, function(err, cids) {

				async.each(cids, upgradeCategory, function(err) {
					if (!err) {
						winston.info('upgraded categories');
						next(null, null);
					} else {
						next(err, null);
					}
				});
			});
		},

		function upgradeUsers(next) {
			winston.info('upgrading users');

			RDB.lrange('userlist', 0, -1, function(err, uids) {

				async.each(uids, upgradeUser, function(err) {
					if (!err) {
						winston.info('upgraded users');
						next(null, null);
					} else {
						next(err, null);
					}
				});

			});
		},

		function upgradeUserHashes(next) {
			winston.info('upgrading user hashes');
			RDB.zrange('users:joindate', 0, -1, function(err, uids) {
				if (err)
					return next(err);

				async.each(uids, upgradeUserHash, function(err) {
					if (!err) {
						winston.info('upgraded user hashes');
						next(null, null);
					} else {
						next(err, null);
					}
				});
			});
		},

		upgradeAdmins
	];

	async.series(schema, function(err, results) {
		if (!err)
			winston.info('upgrade complete');
		else
			winston.err(err);

		process.exit();

	});
}