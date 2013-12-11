var async = require('async'),
	winston = require('winston'),
	cron = require('cron').CronJob,

	db = require('./database'),
	utils = require('../public/src/utils'),
	websockets = require('./websockets');



(function(Notifications) {
	"use strict";

	Notifications.init = function() {
		if (process.env.NODE_ENV === 'development') {
			winston.info('[notifications.init] Registering jobs.');
		}
		new cron('0 0 * * *', Notifications.prune, null, true);
	};

	Notifications.get = function(nid, uid, callback) {

		db.exists('notifications:' + nid, function(err, exists) {
			if(!exists) {
				return callback(null);
			}

			db.sortedSetRank('uid:' + uid + ':notifications:read', nid, function(err, rank) {

				db.getObjectFields('notifications:' + nid, ['nid', 'text', 'score', 'path', 'datetime', 'uniqueId'], function(err, notification) {

					notification.read = rank !== null ? true:false;
					callback(notification);
				});
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

		db.delete('notifications:' + nid, function(err, result) {
			db.setRemove('notifications', nid, function(err, result) {
				if (err) {
					winston.error('Problem deleting expired notifications. Stack follows.');
					winston.error(err.stack);
				}
			});
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
		if (parseInt(uid, 10) > 0) {
			Notifications.get(nid, uid, function(notif_data) {
				async.parallel([
					function(next) {
						db.sortedSetRemove('uid:' + uid + ':notifications:unread', nid, next);
					},
					function(next) {
						db.sortedSetAdd('uid:' + uid + ':notifications:read', notif_data.datetime, nid, next);
					}
				], function(err) {
					if (callback) {
						callback();
					}
				});
			});
		}
	};

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
				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if(err) {
						return next(err);
					}
					uids = uids.map(function(uid) {
						return 'uid:' + uid + ':notifications:unread';
					});
					next(null, uids);
				});
			},
			"expiredNids": function(next) {
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
			if(err) {
				if (process.env.NODE_ENV === 'development') {
					winston.error('[notifications.prune] Ran into trouble pruning expired notifications. Stack trace to follow.');
					winston.error(err.stack);
				}
				return;
			}

			async.eachSeries(results.expiredNids, function(nid, next) {

				db.sortedSetsScore(results.inboxes, nid, function(err, results) {
					if(err) {
						return next(err);
					}

					// If the notification is not present in any inbox, delete it altogether
					var	expired = results.every(function(present) {
							return present === null;
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

		});
	};

}(exports));

