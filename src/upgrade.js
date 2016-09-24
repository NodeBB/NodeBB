"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	Upgrade = {},

	minSchemaDate = Date.UTC(2015, 10, 6),		// This value gets updated every new MAJOR version
	schemaDate, thisSchemaDate,

	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	latestSchema = Date.UTC(2016, 9, 14);

Upgrade.check = function (callback) {
	db.get('schemaDate', function (err, value) {
		if (err) {
			return callback(err);
		}

		if (!value) {
			db.set('schemaDate', latestSchema, function (err) {
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

Upgrade.update = function (schemaDate, callback) {
	db.set('schemaDate', schemaDate, callback);
};

Upgrade.upgrade = function (callback) {
	var updatesMade = false;

	winston.info('Beginning database schema update');

	async.series([
		function (next) {
			// Prepare for upgrade & check to make sure the upgrade is possible
			db.get('schemaDate', function (err, value) {
				if (err) {
					return next(err);
				}

				if(!value) {
					db.set('schemaDate', latestSchema, function () {
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
		function (next) {
			thisSchemaDate = Date.UTC(2015, 11, 15);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/12/15] Upgrading chats');

				db.getObjectFields('global', ['nextMid', 'nextChatRoomId'], function (err, globalData) {
					if (err) {
						return next(err);
					}

					var rooms = {};
					var roomId = globalData.nextChatRoomId || 1;
					var currentMid = 1;

					async.whilst(function () {
						return currentMid <= globalData.nextMid;
					}, function (next) {
						db.getObject('message:' + currentMid, function (err, message) {
							function addMessageToUids(roomId, callback) {
								async.parallel([
									function (next) {
										db.sortedSetAdd('uid:' + message.fromuid + ':chat:room:' + roomId + ':mids', msgTime, currentMid, next);
									},
									function (next) {
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
								addMessageToUids(rooms[pairID], function (err) {
									if (err) {
										return next(err);
									}
									currentMid ++;
									next();
								});
							} else {
								winston.info('adding message ' + currentMid + ' to new roomID ' + roomId);
								async.parallel([
									function (next) {
										db.sortedSetAdd('uid:' + message.fromuid + ':chat:rooms', msgTime, roomId, next);
									},
									function (next) {
										db.sortedSetAdd('uid:' + message.touid + ':chat:rooms', msgTime, roomId, next);
									},
									function (next) {
										db.sortedSetAdd('chat:room:' + roomId + ':uids', [msgTime, msgTime + 1], [message.fromuid, message.touid], next);
									},
									function (next) {
										addMessageToUids(roomId, next);
									}
								], function (err) {
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
					}, function (err) {
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
		function (next) {
			thisSchemaDate = Date.UTC(2015, 11, 23);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/12/23] Upgrading chat room hashes');

				db.getObjectField('global', 'nextChatRoomId', function (err, nextChatRoomId) {
					if (err) {
						return next(err);
					}
					var currentChatRoomId = 1;
					async.whilst(function () {
						return currentChatRoomId <= nextChatRoomId;
					}, function (next) {
						db.getSortedSetRange('chat:room:' + currentChatRoomId + ':uids', 0, 0, function (err, uids) {
							if (err) {
								return next(err);
							}
							if (!Array.isArray(uids) || !uids.length || !uids[0]) {
								++ currentChatRoomId;
								return next();
							}

							db.setObject('chat:room:' + currentChatRoomId, {owner: uids[0], roomId: currentChatRoomId}, function (err) {
								if (err) {
									return next(err);
								}
								++ currentChatRoomId;
								next();
							});
						});
					}, function (err) {
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
		function (next) {
			thisSchemaDate = Date.UTC(2016, 0, 11);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/12/23] Adding theme to active plugins sorted set');

				async.waterfall([
					async.apply(db.getObjectField, 'config', 'theme:id'),
					async.apply(db.sortedSetAdd, 'plugins:active', 0)
				], function (err) {
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
		function (next) {
			thisSchemaDate = Date.UTC(2016, 0, 14);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/01/14] Creating user best post sorted sets');

				var batch = require('./batch');

				batch.processSortedSet('posts:pid', function (ids, next) {
					async.eachSeries(ids, function (id, next) {
						db.getObjectFields('post:' + id, ['pid', 'uid', 'votes'], function (err, postData) {
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
				}, {}, function (err) {
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
		function (next) {
			thisSchemaDate = Date.UTC(2016, 0, 20);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/01/20] Creating users:notvalidated');

				var batch = require('./batch');
				var now = Date.now();
				batch.processSortedSet('users:joindate', function (ids, next) {
					async.eachSeries(ids, function (id, next) {
						db.getObjectFields('user:' + id, ['uid', 'email:confirmed'], function (err, userData) {
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
				}, {}, function (err) {
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
		function (next) {
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
				], function (err) {
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
		function (next) {
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
				], function (err) {
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
		function (next) {
			thisSchemaDate = Date.UTC(2016, 3, 14);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/04/14] Group title from settings to user profile');

				var user = require('./user');
				var batch = require('./batch');
				var count = 0;
				batch.processSortedSet('users:joindate', function (uids, next) {
					winston.info('upgraded ' + count + ' users');
					user.getMultipleUserSettings(uids, function (err, settings) {
						if (err) {
							return next(err);
						}
						count += uids.length;
						settings = settings.filter(function (setting) {
							return setting && setting.groupTitle;
						});

						async.each(settings, function (setting, next) {
							db.setObjectField('user:' + setting.uid, 'groupTitle', setting.groupTitle, next);
						}, next);
					});
				}, {}, function (err) {
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
		function (next) {
			thisSchemaDate = Date.UTC(2016, 3, 18);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/04/19] Users post count per tid');

				var batch = require('./batch');
				var topics = require('./topics');
				var count = 0;
				batch.processSortedSet('topics:tid', function (tids, next) {
					winston.info('upgraded ' + count + ' topics');
					count += tids.length;
					async.each(tids, function (tid, next) {
						db.delete('tid:' + tid + ':posters', function (err) {
							if (err) {
								return next(err);
							}
							topics.getPids(tid, function (err, pids) {
								if (err) {
									return next(err);
								}

								if (!pids.length) {
									return next();
								}

								async.eachSeries(pids, function (pid, next) {
									db.getObjectField('post:' + pid, 'uid', function (err, uid) {
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
				}, {}, function (err) {
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
		function (next) {
			thisSchemaDate = Date.UTC(2016, 3, 29);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/04/29] Dismiss flags from deleted topics');

				var posts = require('./posts'),
					topics = require('./topics');

				var pids, tids;

				async.waterfall([
					async.apply(db.getSortedSetRange, 'posts:flagged', 0, -1),
					function (_pids, next) {
						pids = _pids;
						posts.getPostsFields(pids, ['tid'], next);
					},
					function (_tids, next) {
						tids = _tids.map(function (a) {
							return a.tid;
						});

						topics.getTopicsFields(tids, ['deleted'], next);
					},
					function (state, next) {
						var toDismiss = state.map(function (a, idx) {
							return parseInt(a.deleted, 10) === 1 ? pids[idx] : null;
						}).filter(Boolean);

						winston.info('[2016/04/29] ' + toDismiss.length + ' dismissable flags found');
						async.each(toDismiss, posts.dismissFlag, next);
					}
				], function (err) {
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
		},
		function (next) {
			thisSchemaDate = Date.UTC(2016, 4, 28);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/05/28] Giving topics:read privs to any group that was previously allowed to Find & Access Category');

				var groupsAPI = require('./groups');
				var privilegesAPI = require('./privileges');

				db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
					if (err) {
						return next(err);
					}

					async.eachSeries(cids, function (cid, next) {
						privilegesAPI.categories.list(cid, function (err, data) {
							if (err) {
								return next(err);
							}

							var groups = data.groups;
							var users = data.users;

							async.waterfall([
								function (next) {
									async.eachSeries(groups, function (group, next) {
										if (group.privileges['groups:read']) {
											return groupsAPI.join('cid:' + cid + ':privileges:groups:topics:read', group.name, function (err) {
												if (!err) {
													winston.info('cid:' + cid + ':privileges:groups:topics:read granted to gid: ' + group.name);
												}

												return next(err);
											});
										}

										next(null);
									}, next);
								},
								function (next) {
									async.eachSeries(users, function (user, next) {
										if (user.privileges.read) {
											return groupsAPI.join('cid:' + cid + ':privileges:topics:read', user.uid, function (err) {
												if (!err) {
													winston.info('cid:' + cid + ':privileges:topics:read granted to uid: ' + user.uid);
												}

												return next(err);
											});
										}

										next(null);
									}, next);
								}
							], function (err) {
								if (!err) {
									winston.info('-- cid ' + cid + ' upgraded');
								}

								next(err);
							});
						});
					}, function (err) {
						if (err) {
							return next(err);
						}

						winston.info('[2016/05/28] Giving topics:read privs to any group that was previously allowed to Find & Access Category - done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2016/05/28] Giving topics:read privs to any group that was previously allowed to Find & Access Category - skipped!');
				next();
			}
		},
		function (next) {
			thisSchemaDate = Date.UTC(2016, 5, 13);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/06/13] Store upvotes/downvotes separately');

				var batch = require('./batch');
				var posts = require('./posts');
				var count = 0;
				batch.processSortedSet('posts:pid', function (pids, next) {
					winston.info('upgraded ' + count + ' posts');
					count += pids.length;
					async.each(pids, function (pid, next) {
						async.parallel({
							upvotes: function (next) {
								db.setCount('pid:' + pid + ':upvote', next);
							},
							downvotes: function (next) {
								db.setCount('pid:' + pid + ':downvote', next);
							}
						}, function (err, results) {
							if (err) {
								return next(err);
							}
							var data = {};

							if (parseInt(results.upvotes, 10) > 0) {
								data.upvotes = results.upvotes;
							}
							if (parseInt(results.downvotes, 10) > 0) {
								data.downvotes = results.downvotes;
							}

							if (Object.keys(data).length) {
								posts.setPostFields(pid, data, next);
							} else {
								next();
							}
						}, next);
					}, next);
				}, {}, function (err) {
					if (err) {
						return next(err);
					}

					winston.info('[2016/06/13] Store upvotes/downvotes separately done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/06/13] Store upvotes/downvotes separately skipped!');
				next();
			}
		},
		function (next) {
			thisSchemaDate = Date.UTC(2016, 6, 12);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/07/12] Giving upload privileges');
				var privilegesAPI = require('./privileges');
				var meta = require('./meta');

				db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
					if (err) {
						return next(err);
					}

					async.eachSeries(cids, function (cid, next) {
						privilegesAPI.categories.list(cid, function (err, data) {
							if (err) {
								return next(err);
							}
							async.eachSeries(data.groups, function (group, next) {
								if (group.name === 'guests' && parseInt(meta.config.allowGuestUploads, 10) !== 1) {
									return next();
								}
								if (group.privileges['groups:read']) {
									privilegesAPI.categories.give(['upload:post:image'], cid, group.name, next);
								} else {
									next();
								}
							}, next);
						});
					}, function (err) {
						if (err) {
							return next(err);
						}

						winston.info('[2016/07/12] Upload privileges done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2016/07/12] Upload privileges skipped!');
				next();
			}
		},
		function (next) {
			thisSchemaDate = Date.UTC(2016, 7, 5);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/08/05] Removing best posts with negative scores');
				var batch = require('./batch');
				batch.processSortedSet('users:joindate', function (ids, next) {
					async.each(ids, function (id, next) {
						console.log('processing uid ' + id);
						db.sortedSetsRemoveRangeByScore(['uid:' + id + ':posts:votes'], '-inf', 0, next);
					}, next);
				}, {}, function (err) {
					if (err) {
						return next(err);
					}
					winston.info('[2016/08/05] Removing best posts with negative scores done!');
					Upgrade.update(thisSchemaDate, next);
				});

			} else {
				winston.info('[2016/08/05] Removing best posts with negative scores skipped!');
				next();
			}
		},
		function (next) {
			thisSchemaDate = Date.UTC(2016, 8, 7);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/08/07] Granting edit/delete/delete topic on existing categories');

				var groupsAPI = require('./groups');
				var privilegesAPI = require('./privileges');

				db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
					if (err) {
						return next(err);
					}

					async.eachSeries(cids, function (cid, next) {
						privilegesAPI.categories.list(cid, function (err, data) {
							if (err) {
								return next(err);
							}

							var groups = data.groups;
							var users = data.users;

							async.waterfall([
								function (next) {
									async.eachSeries(groups, function (group, next) {
										if (group.privileges['groups:topics:reply']) {
											return async.parallel([
												async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:groups:posts:edit', group.name),
												async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:groups:posts:delete', group.name)
											], function (err) {
												if (!err) {
													winston.info('cid:' + cid + ':privileges:groups:posts:edit, cid:' + cid + ':privileges:groups:posts:delete granted to gid: ' + group.name);
												}

												return next(err);
											});
										}

										next(null);
									}, next);
								},
								function (next) {
									async.eachSeries(groups, function (group, next) {
										if (group.privileges['groups:topics:create']) {
											return groupsAPI.join('cid:' + cid + ':privileges:groups:topics:delete', group.name, function (err) {
												if (!err) {
													winston.info('cid:' + cid + ':privileges:groups:topics:delete granted to gid: ' + group.name);
												}

												return next(err);
											});
										}

										next(null);
									}, next);
								},
								function (next) {
									async.eachSeries(users, function (user, next) {
										if (user.privileges['topics:reply']) {
											return async.parallel([
												async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:posts:edit', user.uid),
												async.apply(groupsAPI.join, 'cid:' + cid + ':privileges:posts:delete', user.uid)
											], function (err) {
												if (!err) {
													winston.info('cid:' + cid + ':privileges:posts:edit, cid:' + cid + ':privileges:posts:delete granted to uid: ' + user.uid);
												}

												return next(err);
											});
										}

										next(null);
									}, next);
								},
								function (next) {
									async.eachSeries(users, function (user, next) {
										if (user.privileges['topics:create']) {
											return groupsAPI.join('cid:' + cid + ':privileges:topics:delete', user.uid, function (err) {
												if (!err) {
													winston.info('cid:' + cid + ':privileges:topics:delete granted to uid: ' + user.uid);
												}

												return next(err);
											});
										}

										next(null);
									}, next);
								}
							], function (err) {
								if (!err) {
									winston.info('-- cid ' + cid + ' upgraded');
								}

								next(err);
							});
						});
					}, function (err) {
						if (err) {
							return next(err);
						}

						winston.info('[2016/08/07] Granting edit/delete/delete topic on existing categories - done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2016/08/07] Granting edit/delete/delete topic on existing categories - skipped!');
				next();
			}
		},
		function (next) {
			thisSchemaDate = Date.UTC(2016, 8, 22);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/09/22] Setting category recent tids');


				db.getSortedSetRange('categories:cid', 0, -1, function (err, cids) {
					if (err) {
						return next(err);
					}

					async.eachSeries(cids, function (cid, next) {
						db.getSortedSetRevRange('cid:' + cid + ':pids', 0, 0, function (err, pid) {
							if (err || !pid) {
								return next(err);
							}
							db.getObjectFields('post:' + pid, ['tid', 'timestamp'], function (err, postData) {
								if (err || !postData || !postData.tid) {
									return next(err);
								}
								db.sortedSetAdd('cid:' + cid + ':recent_tids', postData.timestamp, postData.tid, next);
							});
						});
					}, function (err) {
						if (err) {
							return next(err);
						}

						winston.info('[2016/09/22] Setting category recent tids - done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2016/09/22] Setting category recent tids - skipped!');
				next();
			}
		},
		function (next) {
			function upgradePosts(next) {
				var batch = require('./batch');

				batch.processSortedSet('posts:pid', function (ids, next) {
					async.each(ids, function (id, next) {
						console.log('processing pid ' + id);
						async.waterfall([
							function (next) {
								db.rename('pid:' + id + ':users_favourited', 'pid:' + id + ':users_bookmarked', next);
							},
							function (next) {
								db.getObjectField('post:' + id, 'reputation', next);
							},
							function (reputation, next) {
								if (parseInt(reputation, 10)) {
									db.setObjectField('post:' + id, 'bookmarks', reputation, next);
								} else {
									next();
								}
							},
							function (next) {
								db.deleteObjectField('post:' + id, 'reputation', next);
							}
						], next);
					}, next);
				}, {}, next);
			}

			function upgradeUsers(next) {
				var batch = require('./batch');

				batch.processSortedSet('users:joindate', function (ids, next) {
					async.each(ids, function (id, next) {
						console.log('processing uid ' + id);
						db.rename('uid:' + id + ':favourites', 'uid:' + id + ':bookmarks', next);
					}, next);
				}, {}, next);
			}

			thisSchemaDate = Date.UTC(2016, 9, 8);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/10/8] favourite -> bookmark refactor');
				async.series([upgradePosts, upgradeUsers], function (err) {
					if (err) {
						return next(err);
					}
					winston.info('[2016/08/05] favourite- bookmark refactor done!');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/10/8] favourite -> bookmark refactor - skipped!');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2016, 9, 14);

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2016/10/14] Creating sorted sets for post replies');

				var posts = require('./posts');
				var batch = require('./batch');
				batch.processSortedSet('posts:pid', function(ids, next) {
					posts.getPostsFields(ids, ['pid', 'toPid', 'timestamp'], function(err, data) {
						if (err) {
							return next(err);
						}

						async.each(data, function(postData, next) {
							if (!parseInt(post.toPid, 10)) {
								return next(null);
							}
							db.sortedSetAdd('pid:' + postData.toPid + ':replies', postData.timestamp, postData.pid, next);
						}, next);
					});
				}, function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2016/10/14] Creating sorted sets for post replies - done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2016/10/14] Creating sorted sets for post replies - skipped!');
				next();
			}
		}
		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 24!!!
	], function (err) {
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
