"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),
	notifications = require('./notifications'),
	categories = require('./categories'),
	nconf = require('nconf'),
	Upgrade = {},

	schemaDate, thisSchemaDate;

Upgrade.check = function(callback) {
	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	var	latestSchema = new Date(2013, 11, 11).getTime();

	db.get('schemaDate', function(err, value) {
		if (parseInt(value, 10) >= latestSchema) {
			callback(true);
		} else {
			callback(false);
		}
	});
};

Upgrade.upgrade = function(callback) {
	var databaseType = nconf.get('database');

	if(databaseType === 'redis') {
		Upgrade.upgradeRedis(callback);
	} else if(databaseType === 'mongo') {
		Upgrade.upgradeMongo(callback);
	} else {
		winston.error('Unknown database type. Aborting upgrade');
		callback(new Error('unknown-database'));
	}
};

Upgrade.upgradeRedis = function(callback) {

	var RDB = db.client,
		updatesMade = false;

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
				updatesMade = true;
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
											if (notif_data) {
												RDB.zadd(key, notif_data.datetime, nid, next);
											} else {
												next();
											}
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
				updatesMade = true;
				RDB.keys('notifications:*', function(err, keys) {

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

					if(keys && Array.isArray(keys)) {
						async.each(keys, function(key, cb) {
							RDB.sadd('notifications', key, cb);
						}, next);
					} else next();

				});
			} else {
				winston.info('[2013/10/23] Updates to Notifications skipped.');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2013, 10, 11).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				RDB.hset('config', 'postDelay', 10, function(err, success) {
					winston.info('[2013/11/11] Updated postDelay to 10 seconds.');
					next();
				});
			} else {
				winston.info('[2013/11/11] Update to postDelay skipped.');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2013, 10, 22).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				RDB.keys('category:*', function(err, categories) {
					async.each(categories, function(categoryStr, next) {
						var	hex;
						RDB.hgetall(categoryStr, function(err, categoryObj) {
							switch(categoryObj.blockclass) {
								case 'category-purple':
									hex = '#ab1290';
									break;

								case 'category-darkblue':
									hex = '#004c66';
									break;

								case 'category-blue':
									hex = '#0059b2';
									break;

								case 'category-darkgreen':
									hex = '#004000';
									break;

								case 'category-orange':
									hex = '#ff7a4d';
									break;

								default:
									hex = '#0059b2';
									break;
							}

							RDB.hset(categoryStr, 'bgColor', hex, next);
							RDB.hdel(categoryStr, 'blockclass');
						});
					}, function() {
						winston.info('[2013/11/22] Updated Category colours.');
						next();
					});
				});
			} else {
				winston.info('[2013/11/22] Update to Category colours skipped.');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2013, 10, 26).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				categories.getAllCategories(0, function(err, categories) {

					function updateIcon(category, next) {
						var icon = '';
						if(category.icon === 'icon-lightbulb') {
							icon = 'fa-lightbulb-o';
						} else if(category.icon === 'icon-plus-sign') {
							icon = 'fa-plus';
						} else if(category.icon === 'icon-screenshot') {
							icon = 'fa-crosshairs';
						} else {
							icon = category.icon.replace('icon-', 'fa-');
						}

						RDB.hset('category:' + category.cid, 'icon', icon, next);
					}

					async.each(categories.categories, updateIcon, function(err) {
						if(err) {
							return next(err);
						}
						winston.info('[2013/11/26] Updated Category icons.');
						next();
					});
				});
			} else {
				winston.info('[2013/11/26] Update to Category icons skipped.');
				next();
			}
		},
		function(next) {

			function updateKeyToHash(key, next) {
				RDB.get(key, function(err, value) {
					if(err) {
						return next(err);
					}

					if(value === null) {
						RDB.hset('global', newKeys[key], initialValues[key], next);
					} else {
						RDB.hset('global', newKeys[key], value, next);
					}
				});
			}

			thisSchemaDate = new Date(2013, 11, 2).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				var keys = [
					'global:next_user_id',
					'next_topic_id',
					'next_gid',
					'notifications:next_nid',
					'global:next_category_id',
					'global:next_message_id',
					'global:next_post_id',
					'usercount',
					'totaltopiccount',
					'totalpostcount'
				];

				var newKeys = {
					'global:next_user_id':'nextUid',
					'next_topic_id':'nextTid',
					'next_gid':'nextGid',
					'notifications:next_nid':'nextNid',
					'global:next_category_id':'nextCid',
					'global:next_message_id':'nextMid',
					'global:next_post_id':'nextPid',
					'usercount':'userCount',
					'totaltopiccount':'topicCount',
					'totalpostcount':'postCount'
				};

				var initialValues = {
					'global:next_user_id': 1,
					'next_topic_id': 0,
					'next_gid': 1,
					'notifications:next_nid': 0,
					'global:next_category_id': 12,
					'global:next_message_id': 0,
					'global:next_post_id': 0,
					'usercount': 1,
					'totaltopiccount': 0,
					'totalpostcount': 0
				};

				async.each(keys, updateKeyToHash, function(err) {
					if(err) {
						return next(err);
					}
					winston.info('[2013/12/2] Updated global keys to hash.');
					next();
				});

			} else {
				winston.info('[2013/12/2] Update to global keys skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2013, 11, 11).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				RDB.hset('config', 'allowGuestSearching', '0', function(err){
					if (err) {
						return next(err);
					}
					winston.info('[2013/12/11] Updated guest search config.');
					next();
				});
			} else {
				winston.info('[2013/12/11] Update to guest search skipped');
				next();
			}
		}
		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 12!!!
	], function(err) {
		if (!err) {
			RDB.set('schemaDate', thisSchemaDate, function(err) {
				if (!err) {
					if(updatesMade) {
						winston.info('[upgrade] Redis schema update complete!');
					} else {
						winston.info('[upgrade] Redis schema already up to date!');
					}
					if (callback) {
						callback(err);
					} else {
						process.exit();
					}
				} else {
					winston.error('[upgrade] Could not update NodeBB schema date!');
					process.exit();
				}
			});
		} else {
			winston.error('[upgrade] Errors were encountered while updating the NodeBB schema: ' + err.message);
			process.exit();
		}
	});
};

Upgrade.upgradeMongo = function(callback) {
	// why can't we just use the abstracted db module here? and in upgradeRedis()?
	var MDB = db.client,
		updatesMade = false;

	winston.info('Beginning Mongo database schema update');

	async.series([
		function(next) {
			db.get('schemaDate', function(err, value) {
				schemaDate = value;
				thisSchemaDate = new Date(2013, 11, 6).getTime();
				next();
			});
		},
		function(next) {

			thisSchemaDate = new Date(2013, 11, 11).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.setObjectField('config', 'allowGuestSearching', '0', function(err){
					if (err) {
						return next(err);
					}
					winston.info('[2013/12/11] Updated guest search config.');
					next();
				});
			} else {
				winston.info('[2013/12/11] Update to guest search skipped');
				next();
			}
		}
		// Add new schema updates here

	], function(err) {
		if (!err) {
			db.set('schemaDate', thisSchemaDate, function(err) {
				if (!err) {
					if(updatesMade) {
						winston.info('[upgrade] Mongo schema update complete!');
					} else {
						winston.info('[upgrade] Mongo schema already up to date!');
					}
					if (callback) {
						callback(err);
					} else {
						process.exit();
					}
				} else {
					winston.error('[upgrade] Could not update NodeBB schema date!');
					process.exit();
				}
			});
		} else {
			winston.error('[upgrade] Errors were encountered while updating the NodeBB schema: ' + err.message);
			process.exit();
		}
	});
}

module.exports = Upgrade;