"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	Upgrade = {},

	minSchemaDate = Date.UTC(2015, 7, 18),		// This value gets updated every new MINOR version
	schemaDate, thisSchemaDate,

	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	latestSchema = Date.UTC(2015, 11, 23);

Upgrade.check = function(callback) {
	db.get('schemaDate', function(err, value) {
		if (err) {
			return callback(err);
		}

		if (!value) {
			db.set('schemaDate', latestSchema, function(err) {
				if (err) {
					return callback(err);
				}
				callback(null);
			});
			return;
		}

		var schema_ok = parseInt(value, 10) >= latestSchema;
		callback(!schema_ok ? new Error('schema-out-of-date') : null);
	});
};

Upgrade.update = function(schemaDate, callback) {
	db.set('schemaDate', schemaDate, callback);
};

Upgrade.upgrade = function(callback) {
	var updatesMade = false;

	winston.info('Beginning database schema update');

	async.series([
		function(next) {
			// Prepare for upgrade & check to make sure the upgrade is possible
			db.get('schemaDate', function(err, value) {
				if(!value) {
					db.set('schemaDate', latestSchema, function() {
						next();
					});
					schemaDate = latestSchema;
				} else {
					schemaDate = parseInt(value, 10);
				}

				if (schemaDate >= minSchemaDate) {
					next();
				} else {
					next(new Error('upgrade-not-possible'));
				}
			});
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 8, 30);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar');

				async.waterfall([
					async.apply(db.isObjectField, 'config', 'customGravatarDefaultImage'),
					function(keyExists, _next) {
						if (keyExists) {
							_next();
						} else {
							winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar skipped');
							Upgrade.update(thisSchemaDate, next);
							next();
						}
					},
					async.apply(db.getObjectField, 'config', 'customGravatarDefaultImage'),
					async.apply(db.setObjectField, 'config', 'defaultAvatar'),
					async.apply(db.deleteObjectField, 'config', 'customGravatarDefaultImage')
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 10, 6);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/11/06] Removing gravatar');

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if (err) {
						return next(err);
					}

					async.eachLimit(uids, 500, function(uid, next) {
						db.getObjectFields('user:' + uid, ['picture', 'gravatarpicture'], function(err, userData) {
							if (err) {
								return next(err);
							}

							if (!userData.picture || !userData.gravatarpicture) {
								return next();
							}

							if (userData.gravatarpicture === userData.picture) {
								async.series([
									function (next) {
										db.setObjectField('user:' + uid, 'picture', '', next);
									},
									function (next) {
										db.deleteObjectField('user:' + uid, 'gravatarpicture', next);
									}
								], next);
							} else {
								db.deleteObjectField('user:' + uid, 'gravatarpicture', next);
							}
						});
					}, function(err) {
						if (err) {
							return next(err);
						}

						winston.info('[2015/11/06] Gravatar pictures removed!');
						Upgrade.update(thisSchemaDate, next);
					});
				});

			} else {
				winston.info('[2015/11/06] Gravatar removal skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 11, 15);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/12/15] Upgrading chats');

				db.getObjectFields('global', ['nextMid', 'nextChatRoomId'], function(err, globalData) {
					if (err) {
						return next(err);
					}

					var rooms = {};
					var roomId = globalData.nextChatRoomId || 1;
					var currentMid = 1;

					async.whilst(function() {
						return currentMid < globalData.nextMid;
					}, function(next) {
						db.getObject('message:' + currentMid, function(err, message) {
							function addMessageToUids(roomId, callback) {
								async.parallel([
									function(next) {
										db.sortedSetAdd('uid:' + message.fromuid + ':chat:room:' + roomId + ':mids', msgTime, currentMid, next);
									},
									function(next) {
										db.sortedSetAdd('uid:' + message.touid + ':chat:room:' + roomId + ':mids', msgTime, currentMid, next);
									}
								], callback);
							}

							if (err || !message)  {
								winston.info('skipping chat message ', currentMid);
								currentMid ++;
								return next(err);
							}

							var pairID = [parseInt(message.fromuid, 10), parseInt(message.touid, 10)].sort().join(':');
							var msgTime = parseInt(message.timestamp, 10);

							if (rooms[pairID]) {
								winston.info('adding message ' + currentMid + ' to existing roomID ' + roomId);
								addMessageToUids(rooms[pairID], function(err) {
									if (err) {
										return next(err);
									}
									currentMid ++;
									next();
								});
							} else {
								winston.info('adding message ' + currentMid + ' to new roomID ' + roomId);
								async.parallel([
									function(next) {
										db.sortedSetAdd('uid:' + message.fromuid + ':chat:rooms', msgTime, roomId, next);
									},
									function(next) {
										db.sortedSetAdd('uid:' + message.touid + ':chat:rooms', msgTime, roomId, next);
									},
									function(next) {
										db.sortedSetAdd('chat:room:' + roomId + ':uids', [msgTime, msgTime + 1], [message.fromuid, message.touid], next);
									},
									function(next) {
										addMessageToUids(roomId, next);
									}
								], function(err) {
									if (err) {
										return next(err);
									}
									rooms[pairID] = roomId;
									roomId ++;
									currentMid ++;
									db.setObjectField('global', 'nextChatRoomId', roomId, next);
								});
							}
						});
					}, function(err) {
						if (err) {
							return next(err);
						}

						winston.info('[2015/12/15] Chats upgrade done!');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/12/15] Chats upgrade skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 11, 23);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/12/23] Upgrading chat room hashes');

				db.getObjectField('global', 'nextChatRoomId', function(err, nextChatRoomId) {
					if (err) {
						return next(err);
					}
					var currentChatRoomId = 1;
					async.whilst(function() {
						return currentChatRoomId < nextChatRoomId;
					}, function(next) {
						db.getSortedSetRange('chat:room:' + currentChatRoomId + ':uids', 0, 0, function(err, uids) {
							if (err) {
								return next(err);
							}
							if (!Array.isArray(uids) || !uids.length || !uids[0]) {
								++ currentChatRoomId;
								return next();
							}

							db.setObject('chat:room:' + currentChatRoomId, {owner: uids[0], roomId: currentChatRoomId}, function(err) {
								if (err) {
									return next(err);
								}
								++ currentChatRoomId;
								next();
							});
						});
					}, function(err) {
						if (err) {
							return next(err);
						}

						winston.info('[2015/12/23] Chats room hashes upgrade done!');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/12/23] Chats room hashes upgrade skipped!');
				next();
			}
		}
		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 24!!!
	], function(err) {
		if (!err) {
			if(updatesMade) {
				winston.info('[upgrade] Schema update complete!');
			} else {
				winston.info('[upgrade] Schema already up to date!');
			}
		} else {
			switch(err.message) {
			case 'upgrade-not-possible':
				winston.error('[upgrade] NodeBB upgrade could not complete, as your database schema is too far out of date.');
				winston.error('[upgrade]   Please ensure that you did not skip any minor version upgrades.');
				winston.error('[upgrade]   (e.g. v0.1.x directly to v0.3.x)');
				break;

			default:
				winston.error('[upgrade] Errors were encountered while updating the NodeBB schema: ' + err.message);
				break;
			}
		}

		if (typeof callback === 'function') {
			callback(err);
		} else {
			process.exit();
		}
	});
};

module.exports = Upgrade;
