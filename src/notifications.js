var async = require('async'),
	winston = require('winston'),
	cron = require('cron').CronJob,

	db = require('./database'),
	utils = require('../public/src/utils'),
	websockets = require('./websockets');



(function(Notifications) {

	Notifications.init = function() {
		if (process.env.NODE_ENV === 'development') {
			winston.info('[notifications.init] Registering jobs.');
		}
		new cron('0 0 * * *', Notifications.prune, null, true);
	};

	Notifications.get = function(nid, uid, callback) {
		RDB.multi()
			.hmget('notifications:' + nid, 'text', 'score', 'path', 'datetime', 'uniqueId')
			.zrank('uid:' + uid + ':notifications:read', nid)
			.exists('notifications:' + nid)
			.exec(function(err, results) {
				var	notification = results[0],
					readIdx = results[1];

				if (!results[2]) {
					return callback(null);
				}

				callback({
					nid: nid,
					text: notification[0],
					score: notification[1],
					path: notification[2],
					datetime: notification[3],
					uniqueId: notification[4],
					read: readIdx !== null ? true : false
				});
			});
	};

	Notifications.create = function(text, path, uniqueId, callback) {
		/**
		 * uniqueId is used solely to override stale nids.
		 * 		If a new nid is pushed to a user and an existing nid in the user's
		 *		(un)read list contains the same uniqueId, it will be removed, and
		 *		the new one put in its place.
		 */
		db.incrObjectField('global', 'nextNid', function(err, nid) {
			db.setAdd('notifications', nid);
			db.setObject('notifications:' + nid, {
				text: text || '',
				path: path || null,
				datetime: Date.now(),
				uniqueId: uniqueId || utils.generateUUID()
			}, function(err, status) {
				if (!err) {
					callback(nid);
				}
			});
		});
	};

	function destroy(nid) {
		var	multi = RDB.multi();

		multi.del('notifications:' + nid);
		multi.srem('notifications', nid);

		multi.exec(function(err) {
			if (err) {
				winston.error('Problem deleting expired notifications. Stack follows.');
				winston.error(err.stack);
			}
		});
	}

	Notifications.push = function(nid, uids, callback) {
		if (!Array.isArray(uids)) {
			uids = [uids];
		}

		var numUids = uids.length,
			x;

		Notifications.get(nid, null, function(notif_data) {
			for (x = 0; x < numUids; x++) {
				if (parseInt(uids[x], 10) > 0) {
					(function(uid) {
						remove_by_uniqueId(notif_data.uniqueId, uid, function() {
							db.sortedSetAdd('uid:' + uid + ':notifications:unread', notif_data.datetime, nid);

							websockets.in('uid_' + uid).emit('event:new_notification');

							if (callback) {
								callback(true);
							}
						});
					})(uids[x]);
				}
			}
		});
	};

	function remove_by_uniqueId(uniqueId, uid, callback) {
		async.parallel([
			function(next) {
				db.getSortedSetRange('uid:' + uid + ':notifications:unread', 0, -1, function(err, nids) {
					if (nids && nids.length > 0) {
						async.each(nids, function(nid, next) {
							Notifications.get(nid, uid, function(nid_info) {
								if (nid_info.uniqueId === uniqueId) {
									db.sortedSetRemove('uid:' + uid + ':notifications:unread', nid);
								}

								next();
							});
						}, function(err) {
							next();
						});
					} else {
						next();
					}
				});
			},
			function(next) {
				db.getSortedSetRange('uid:' + uid + ':notifications:read', 0, -1, function(err, nids) {
					if (nids && nids.length > 0) {
						async.each(nids, function(nid, next) {
							Notifications.get(nid, uid, function(nid_info) {
								if (nid_info && nid_info.uniqueId === uniqueId) {
									db.sortedSetRemove('uid:' + uid + ':notifications:read', nid);
								}

								next();
							});
						}, function(err) {
							next();
						});
					} else {
						next();
					}
				});
			}
		], function(err) {
			if (!err) {
				callback(true);
			}
		});
	}

	Notifications.mark_read = function(nid, uid, callback) {
			if (parseInt(uid) > 0) {
				Notifications.get(nid, uid, function(notif_data) {
					db.sortedSetRemove('uid:' + uid + ':notifications:unread', nid);
					db.sortedSetAdd('uid:' + uid + ':notifications:read', notif_data.datetime, nid);
					if (callback) {
						callback();
					}
				});
			}
		}

	Notifications.mark_read_multiple = function(nids, uid, callback) {
		if (!Array.isArray(nids) && parseInt(nids, 10) > 0) {
			nids = [nids];
		}

		async.each(nids, function(nid, next) {
			Notifications.mark_read(nid, uid, function(err) {
				if (!err) {
					next(null);
				}
			});
		}, function(err) {
			if (callback) {
				callback(err);
			}
		});
	};

	Notifications.mark_all_read = function(uid, callback) {
		db.getSortedSetRange('uid:' + uid + ':notifications:unread', 0, 10, function(err, nids) {
			if (err) {
				return callback(err);
			}

			if (nids.length > 0) {
				Notifications.mark_read_multiple(nids, uid, function(err) {
					callback(err);
				});
			} else {
				callback();
			}
		});
	};

	Notifications.prune = function(cutoff) {
		if (process.env.NODE_ENV === 'development') {
			winston.info('[notifications.prune] Removing expired notifications from the database.');
		}

		var	today = new Date(),
			numPruned = 0;

		if (!cutoff) {
			cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
		}

		var	cutoffTime = cutoff.getTime();

		async.parallel({
			"inboxes": function(next) {
				RDB.keys('uid:*:notifications:unread', next);
			},
			"nids": function(next) {
				db.getSetMembers('notifications', function(err, nids) {
					async.filter(nids, function(nid, next) {
						db.getObjectField('notifications:' + nid, 'datetime', function(err, datetime) {
							if (parseInt(datetime, 10) < cutoffTime) {
								next(true);
							} else {
								next(false);
							}
						});
					}, function(expiredNids) {
						next(null, expiredNids);
					});
				});
			}
		}, function(err, results) {
			if (!err) {
				var	numInboxes = results.inboxes.length,
					x;

				async.eachSeries(results.nids, function(nid, next) {
					var	multi = RDB.multi();

					for(x=0;x<numInboxes;x++) {
						multi.zscore(results.inboxes[x], nid);
					}

					multi.exec(function(err, results) {
						// If the notification is not present in any inbox, delete it altogether
						var	expired = results.every(function(present) {
								if (present === null) {
									return true;
								}
							});

						if (expired) {
							destroy(nid);
							numPruned++;
						}

						next();
					});
				}, function(err) {
					if (process.env.NODE_ENV === 'development') {
						winston.info('[notifications.prune] Notification pruning completed. ' + numPruned + ' expired notification' + (numPruned !== 1 ? 's' : '') + ' removed.');
					}
				});
			} else {
				if (process.env.NODE_ENV === 'development') {
					winston.error('[notifications.prune] Ran into trouble pruning expired notifications. Stack trace to follow.');
					winston.error(err.stack);
				}
			}
		});
	};

}(exports));

