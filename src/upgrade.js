"use strict";

var RDB = require('./redis.js'),
	async = require('async'),
	winston = require('winston'),
	notifications = require('./notifications'),
	Upgrade = {},

	schemaDate, thisSchemaDate;

Upgrade.check = function(callback) {
	var	latestSchema = new Date(2013, 10, 11).getTime();

	RDB.get('schemaDate', function(err, value) {
		if (parseInt(value, 10) > latestSchema) {
			callback(true);
		} else {
			callback(false);
		}
	});
};

Upgrade.upgrade = function() {
	winston.info('Beginning Redis database schema update');

	async.series([
		function(next) {
			RDB.get('schemaDate', function(err, value) {
				schemaDate = value;
				next();
			});
		},
		function(next) {
			thisSchemaDate = new Date(2013, 9, 3).getTime();
			if (schemaDate < thisSchemaDate) {
				async.series([
					function(next) {
						RDB.keys('uid:*:notifications:flag', function(err, keys) {
							if (keys.length > 0) {
								winston.info('[2013/10/03] Removing deprecated Notification Flags');
								async.each(keys, function(key, next) {
									RDB.del(key, next);
								}, next);
							} else {
								winston.info('[2013/10/03] No Notification Flags found. Good.');
								next();
							}
						});
					},
					function(next) {
						winston.info('[2013/10/03] Updating Notifications');
						RDB.keys('uid:*:notifications:*', function(err, keys) {
							async.each(keys, function(key, next) {
								RDB.zrange(key, 0, -1, function(err, nids) {
									async.each(nids, function(nid, next) {
										notifications.get(nid, null, function(notif_data) {
											RDB.zadd(key, notif_data.datetime, nid, next);
										});
									}, next);
								});
							}, next);
						});
					},
					function(next) {
						RDB.keys('notifications:*', function(err, keys) {
							if (keys.length > 0) {
								winston.info('[2013/10/03] Removing Notification Scores');
								async.each(keys, function(key, next) {
									if (key === 'notifications:next_nid') {
										return next();
									}

									RDB.hdel(key, 'score', next);
								}, next);
							} else {
								winston.info('[2013/10/03] No Notification Scores found. Good.');
								next();
							}
						});
					}
				], next);
			} else {
				winston.info('[2013/10/03] Updates to Notifications skipped.');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2013, 9, 23).getTime();
			if (schemaDate < thisSchemaDate) {
				RDB.keys('notifications:*', function(err, keys) {
					var	multi = RDB.multi();

					keys = keys.filter(function(key) {
						if (key === 'notifications:next_nid') {
							return false;
						} else {
							return true;
						}
					}).map(function(key) {
						return key.slice(14);
					});

					winston.info('[2013/10/23] Adding existing notifications to set');
					RDB.sadd('notifications', keys, next);
				});
			} else {
				winston.info('[2013/10/23] Updates to Notifications skipped.');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2013, 10, 11).getTime();
			if (schemaDate < thisSchemaDate) {
				RDB.hset('config', 'postDelay', 10, function(err, success) {
					winston.info('[2013/11/11] Updated postDelay to 10 seconds.');
					next();
				});
			} else {
				winston.info('[2013/11/11] Update to postDelay skipped.');
				next();
			}
		}
		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 12!!!
	], function(err) {
		if (!err) {
			RDB.set('schemaDate', thisSchemaDate, function(err) {
				if (!err) {
					winston.info('[upgrade] Redis schema update complete!');
					process.exit();
				} else {
					winston.error('[upgrade] Could not update NodeBB schema date!');
				}
			});
		} else {
			winston.error('[upgrade] Errors were encountered while updating the NodeBB schema: ' + err.message);
		}
	});
};

module.exports = Upgrade;