"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	Upgrade = {},

	minSchemaDate = Date.UTC(2015, 7, 18),		// This value gets updated every new MINOR version
	schemaDate, thisSchemaDate,

	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	latestSchema = Date.UTC(2016, 3, 29);

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
						return currentMid <= globalData.nextMid;
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
						return currentChatRoomId <= nextChatRoomId;
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
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 0, 11);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/12/23] Adding theme to active plugins sorted set');

				async.waterfall([
					async.apply(db.getObjectField, 'config', 'theme:id'),
					async.apply(db.sortedSetAdd, 'plugins:active', 0)
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2015/12/23] Adding theme to active plugins sorted set done!');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2015/12/23] Adding theme to active plugins sorted set skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 0, 14);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/01/14] Creating user best post sorted sets');

				var batch = require('./batch');

				batch.processSortedSet('posts:pid', function(ids, next) {
					async.eachSeries(ids, function(id, next) {
						db.getObjectFields('post:' + id, ['pid', 'uid', 'votes'], function(err, postData) {
							if (err) {
								return next(err);
							}
							if (!postData || !parseInt(postData.votes, 10) || !parseInt(postData.uid, 10)) {
								return next();
							}
							winston.info('processing pid: ' + postData.pid + ' uid: ' + postData.uid + ' votes: ' + postData.votes);
							db.sortedSetAdd('uid:' + postData.uid + ':posts:votes', postData.votes, postData.pid, next);
						});
					}, next);
				}, {}, function(err) {
					if (err) {
						return next(err);
					}
					winston.info('[2016/01/14] Creating user best post sorted sets done!');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/01/14] Creating user best post sorted sets skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 0, 20);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/01/20] Creating users:notvalidated');

				var batch = require('./batch');
				var now = Date.now();
				batch.processSortedSet('users:joindate', function(ids, next) {
					async.eachSeries(ids, function(id, next) {
						db.getObjectFields('user:' + id, ['uid', 'email:confirmed'], function(err, userData) {
							if (err) {
								return next(err);
							}
							if (!userData || !parseInt(userData.uid, 10) || parseInt(userData['email:confirmed'], 10) === 1) {
								return next();
							}
							winston.info('processing uid: ' + userData.uid + ' email:confirmed: ' + userData['email:confirmed']);
							db.sortedSetAdd('users:notvalidated', now, userData.uid, next);
						});
					}, next);
				}, {}, function(err) {
					if (err) {
						return next(err);
					}
					winston.info('[2016/01/20] Creating users:notvalidated done!');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/01/20] Creating users:notvalidated skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 0, 23);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/01/23] Creating Global moderators group');

				var groups = require('./groups');
				async.waterfall([
					function (next) {
						groups.exists('Global Moderators', next);
					},
					function (exists, next) {
						if (exists) {
							return next(null, null);
						}
						groups.create({
							name: 'Global Moderators',
							userTitle: 'Global Moderator',
							description: 'Forum wide moderators',
							hidden: 0,
							private: 1,
							disableJoinRequests: 1
						}, next);
					},
					function (groupData, next) {
						groups.show('Global Moderators', next);
					}
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2016/01/23] Creating Global moderators group done!');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/01/23] Creating Global moderators group skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 1, 25);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/02/25] Social: Post Sharing');

				var social = require('./social');
				async.parallel([
					function (next) {
						social.setActivePostSharingNetworks(['facebook', 'google', 'twitter'], next);
					},
					function (next) {
						db.deleteObjectField('config', 'disableSocialButtons', next);
					}
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2016/02/25] Social: Post Sharing done!');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/02/25] Social: Post Sharing skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 3, 14);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/04/14] Group title from settings to user profile');

				var user = require('./user');
				var batch = require('./batch');
				var count = 0;
				batch.processSortedSet('users:joindate', function(uids, next) {
					winston.info('upgraded ' + count + ' users');
					user.getMultipleUserSettings(uids, function(err, settings) {
						if (err) {
							return next(err);
						}
						count += uids.length;
						settings = settings.filter(function(setting) {
							return setting && setting.groupTitle;
						});

						async.each(settings, function(setting, next) {
							db.setObjectField('user:' + setting.uid, 'groupTitle', setting.groupTitle, next);
						}, next);
					});
				}, {}, function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2016/04/14] Group title from settings to user profile done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/04/14] Group title from settings to user profile skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 3, 18);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/04/19] Users post count per tid');

				var batch = require('./batch');
				var topics = require('./topics');
				var count = 0;
				batch.processSortedSet('topics:tid', function(tids, next) {
					winston.info('upgraded ' + count + ' topics');
					count += tids.length;
					async.each(tids, function(tid, next) {
						db.delete('tid:' + tid + ':posters', function(err) {
							if (err) {
								return next(err);
							}
							topics.getPids(tid, function(err, pids) {
								if (err) {
									return next(err);
								}

								if (!pids.length) {
									return next();
								}

								async.eachSeries(pids, function(pid, next) {
									db.getObjectField('post:' + pid, 'uid', function(err, uid) {
										if (err) {
											return next(err);
										}
										if (!parseInt(uid, 10)) {
											return next();
										}
										db.sortedSetIncrBy('tid:' + tid + ':posters', 1, uid, next);
									});
								}, next);
							});
						});
					}, next);
				}, {}, function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2016/04/19] Users post count per tid done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/04/19] Users post count per tid skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 3, 29);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/04/29] Dismiss flags from deleted topics');

				var posts = require('./posts'),
					topics = require('./topics');

				var pids, tids;

				async.waterfall([
					async.apply(db.getSortedSetRange, 'posts:flagged', 0, -1),
					function(_pids, next) {
						pids = _pids;
						posts.getPostsFields(pids, ['tid'], next);
					},
					function(_tids, next) {
						tids = _tids.map(function(a) {
							return a.tid;
						});

						topics.getTopicsFields(tids, ['deleted'], next);
					},
					function(state, next) {
						var toDismiss = state.map(function(a, idx) {
							return parseInt(a.deleted, 10) === 1 ? pids[idx] : null;
						}).filter(Boolean);

						winston.info('[2016/04/29] ' + toDismiss.length + ' dismissable flags found');
						async.each(toDismiss, posts.dismissFlag, next);
					}
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2016/04/29] Dismiss flags from deleted topics done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/04/29] Dismiss flags from deleted topics skipped!');
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
