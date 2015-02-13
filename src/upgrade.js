"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),
	fs = require('fs'),
	path = require('path'),

	User = require('./user'),
	Topics = require('./topics'),
	Posts = require('./posts'),
	Categories = require('./categories'),
	Groups = require('./groups'),
	Meta = require('./meta'),
	Plugins = require('./plugins'),
	Utils = require('../public/src/utils'),

	Upgrade = {},

	minSchemaDate = Date.UTC(2014, 9, 22),		// This value gets updated every new MINOR version
	schemaDate, thisSchemaDate,

	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	latestSchema = Date.UTC(2015, 1, 8);

Upgrade.check = function(callback) {
	db.get('schemaDate', function(err, value) {
		if(!value) {
			db.set('schemaDate', latestSchema, function(err) {
				callback(true);
			});
			return;
		}

		if (parseInt(value, 10) >= latestSchema) {
			callback(true);
		} else {
			callback(false);
		}
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
					db.set('schemaDate', latestSchema, function(err) {
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
			thisSchemaDate = Date.UTC(2014, 9, 31);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/10/31] Applying newbiePostDelay values');

				async.series([
					async.apply(Meta.configs.setOnEmpty, 'newbiePostDelay', '120'),
					async.apply(Meta.configs.setOnEmpty, 'newbiePostDelayThreshold', '3')
				], function(err) {
					if (err) {
						winston.error('[2014/10/31] Error encountered while Applying newbiePostDelay values');
						return next(err);
					}
					winston.info('[2014/10/31] Applying newbiePostDelay values done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2014/10/31] Applying newbiePostDelay values skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 10, 6, 18, 30);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/11/6] Updating topic authorship sorted set');

				async.waterfall([
					async.apply(db.getObjectField, 'global', 'nextTid'),
					function(nextTid, next) {
						var tids = [];
						for(var x=1,numTids=nextTid-1;x<numTids;x++) {
							tids.push(x);
						}
						async.filter(tids, function(tid, next) {
							db.exists('topic:' + tid, function(err, exists) {
								next(exists);
							});
						}, function(tids) {
							next(null, tids);
						});
					},
					function(tids, next) {
						async.eachLimit(tids, 100, function(tid, next) {
							Topics.getTopicFields(tid, ['uid', 'cid', 'tid', 'timestamp'], function(err, data) {
								if (!err && (data.cid && data.uid && data.timestamp && data.tid)) {
									db.sortedSetAdd('cid:' + data.cid + ':uid:' + data.uid + ':tid', data.timestamp, data.tid, next);
								} else {
									// Post was probably purged, skip record
									next();
								}
							});
						}, next);
					}
				], function(err) {
					if (err) {
						winston.error('[2014/11/6] Error encountered while Updating topic authorship sorted set');
						return next(err);
					}
					winston.info('[2014/11/6] Updating topic authorship sorted set done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2014/11/6] Updating topic authorship sorted set skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 10, 7);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/11/7] Renaming sorted set names');

				async.waterfall([
					function(next) {
						async.parallel({
							cids: function(next) {
								db.getSortedSetRange('categories:cid', 0, -1, next);
							},
							uids: function(next) {
								db.getSortedSetRange('users:joindate', 0, -1, next);
							}
						}, next);
					},
					function(results, next) {
						async.eachLimit(results.cids, 50, function(cid, next) {
							async.parallel([
								function(next) {
									db.exists('categories:' + cid + ':tid', function(err, exists) {
										if (err || !exists) {
											return next(err);
										}
										db.rename('categories:' + cid + ':tid', 'cid:' + cid + ':tids', next);
									});
								},
								function(next) {
									db.exists('categories:recent_posts:cid:' + cid, function(err, exists) {
										if (err || !exists) {
											return next(err);
										}
										db.rename('categories:recent_posts:cid:' + cid, 'cid:' + cid + ':pids', next);
									});
								},
								function(next) {
									async.eachLimit(results.uids, 50, function(uid, next) {
										db.exists('cid:' + cid + ':uid:' + uid + ':tid', function(err, exists) {
											if (err || !exists) {
												return next(err);
											}
											db.rename('cid:' + cid + ':uid:' + uid + ':tid', 'cid:' + cid + ':uid:' + uid + ':tids', next);
										});
									}, next);
								}
							], next);
						}, next);
					}
				], function(err) {
					if (err) {
						winston.error('[2014/11/7] Error encountered while renaming sorted sets');
						return next(err);
					}
					winston.info('[2014/11/7] Renaming sorted sets done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2014/11/7] Renaming sorted sets skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 10, 11);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/11/11] Upgrading permissions');

				async.waterfall([
					function(next) {
						db.getSortedSetRange('categories:cid', 0, -1, next);
					},
					function(cids, next) {
						function categoryHasPrivilegesSet(cid, privilege, next) {
							async.parallel({
								userPrivExists: function(next) {
									Groups.getMemberCount('cid:' + cid + ':privileges:' + privilege, next);
								},
								groupPrivExists: function(next) {
									Groups.getMemberCount('cid:' + cid + ':privileges:groups:' + privilege, next);
								}
							}, function(err, results) {
								if (err) {
									return next(err);
								}
								next(null, results.userPrivExists || results.groupPrivExists);
							});
						}

						function upgradePrivileges(cid, groups, next) {
							var privs = ['find', 'read', 'topics:reply', 'topics:create'];

							async.each(privs, function(priv, next) {

								categoryHasPrivilegesSet(cid, priv, function(err, privilegesSet) {
									if (err || privilegesSet) {
										return next(err);
									}

									async.eachLimit(groups, 50, function(group, next) {
										if (group && !group.hidden) {
											if (group.name === 'guests' && (priv === 'topics:reply' || priv === 'topics:create')) {
												return next();
											}
											Groups.join('cid:' + cid + ':privileges:groups:' + priv, group.name, next);
										} else {
											next();
										}
									}, next);
								});
							}, next);
						}

						Groups.list({showSystemGroups: true}, function(err, groups) {
							if (err) {
								return next(err);
							}

							async.eachLimit(cids, 50, function(cid, next) {
								upgradePrivileges(cid, groups, next);
							}, next);
						});
					}
				], function(err) {
					if (err) {
						winston.error('[2014/11/11] Error encountered while upgrading permissions');
						return next(err);
					}
					winston.info('[2014/11/11] Upgrading permissions done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2014/11/11] Upgrading permissions skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 10, 17, 13);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/11/17] Updating user email digest settings');

				async.waterfall([
					async.apply(db.getSortedSetRange, 'users:joindate', 0, -1),
					function(uids, next) {
						async.filter(uids, function(uid, next) {
							db.getObjectField('user:' + uid + ':settings', 'dailyDigestFreq', function(err, freq) {
								next(freq === 'daily');
							});
						}, function(uids) {
							next(null, uids);
						});
					},
					function(uids, next) {
						async.each(uids, function(uid, next) {
							db.setObjectField('user:' + uid + ':settings', 'dailyDigestFreq', 'day', next);
						}, next);
					}
				], function(err) {
					if (err) {
						winston.error('[2014/11/17] Error encountered while updating user email digest settings');
						return next(err);
					}
					winston.info('[2014/11/17] Updating user email digest settings done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2014/11/17] Updating user email digest settings skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 10, 29, 22);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/11/29] Updating config.json to new format');
				var configPath = path.join(__dirname, '../config.json');

				async.waterfall([
					async.apply(fs.readFile, configPath, { encoding: 'utf-8' }),
					function(config, next) {
						try {
							config = JSON.parse(config);

							// If the config contains "url", it has already been updated, abort.
							if (config.hasOwnProperty('url')) {
								return next();
							}

							config.url = config.base_url + (config.use_port ? ':' + config.port : '') + config.relative_path;
							if (config.port == '4567') {
								delete config.port;
							}
							if (config.bcrypt_rounds == 12) {
								delete config.bcrypt_rounds;
							}
							if (config.upload_path === '/public/uploads') {
								delete config.upload_path;
							}
							if (config.bind_address === '0.0.0.0') {
								delete config.bind_address;
							}
							delete config.base_url;
							delete config.use_port;
							delete config.relative_path;

							fs.writeFile(configPath, JSON.stringify(config, null, 4), next);
						} catch (err) {
							return next(err);
						}
					}
				], function(err) {
					if (err) {
						winston.error('[2014/11/29] Error encountered while updating config.json to new format');
						return next(err);
					}
					winston.info('[2014/11/29] Updating config.json to new format done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2014/11/29] Updating config.json to new format skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 11, 2);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/12/2] Removing register user fields');

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if (err) {
						return next(err);
					}
					var fieldsToDelete = [
						'password-confirm',
						'recaptcha_challenge_field',
						'_csrf',
						'recaptcha_response_field',
						'referrer'
					];

					async.eachLimit(uids, 50, function(uid, next) {
						async.each(fieldsToDelete, function(field, next) {
							db.deleteObjectField('user:' + uid, field, next);
						}, next);
					}, function(err) {
						if (err) {
							winston.error('[2014/12/2] Error encountered while deleting user fields');
							return next(err);
						}
						winston.info('[2014/12/2] Removing register user fields done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2014/12/2] Removing register user fields skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 11, 12);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/12/12] Updating teasers');

				db.getSortedSetRange('topics:tid', 0, -1, function(err, tids) {
					if (err) {
						return next(err);
					}

					async.eachLimit(tids, 50, function(tid, next) {
						Topics.updateTeaser(tid, next);
					}, function(err) {
						if (err) {
							winston.error('[2014/12/12] Error encountered while updating teasers');
							return next(err);
						}
						winston.info('[2014/12/12] Updating teasers done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2014/12/12] Updating teasers skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 11, 20);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2014/12/20] Updating digest settings');

				async.waterfall([
					async.apply(db.getSortedSetRange, 'users:joindate', 0, -1),
					async.apply(User.getMultipleUserSettings)
				], function(err, userSettings) {
					if (err) {
						winston.error('[2014/12/20] Error encountered while updating digest settings');
						return next(err);
					}

					var now = Date.now();

					async.eachLimit(userSettings, 50, function(setting, next) {
						if (setting.dailyDigestFreq !== 'off') {
							db.sortedSetAdd('digest:' + setting.dailyDigestFreq + ':uids', now, setting.uid, next);
						} else {
							next(false);
						}
					}, function(err) {
						if (err) {
							winston.error('[2014/12/20] Error encountered while updating digest settings');
							return next(err);
						}
						winston.info('[2014/12/20] Updating digest settings done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2014/12/20] Updating digest settings skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 8);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/08] Updating category topics sorted sets');

				db.getSortedSetRange('topics:tid', 0, -1, function(err, tids) {
					if (err) {
						winston.error('[2015/01/08] Error encountered while Updating category topics sorted sets');
						return next(err);
					}

					var now = Date.now();

					async.eachLimit(tids, 50, function(tid, next) {
						db.getObjectFields('topic:' + tid, ['cid', 'postcount'], function(err, topicData) {
							if (err) {
								return next(err);
							}

							if (Utils.isNumber(topicData.postcount) && topicData.cid) {
								db.sortedSetAdd('cid:' + topicData.cid + ':tids:posts', topicData.postcount, tid, next);
							} else {
								next();
							}
						});
					}, function(err) {
						if (err) {
							winston.error('[2015/01/08] Error encountered while Updating category topics sorted sets');
							return next(err);
						}
						winston.info('[2015/01/08] Updating category topics sorted sets done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/08] Updating category topics sorted sets skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 9);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/09] Creating fullname:uid hash');

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if (err) {
						winston.error('[2014/01/09] Error encountered while Creating fullname:uid hash');
						return next(err);
					}

					var now = Date.now();

					async.eachLimit(uids, 50, function(uid, next) {
						db.getObjectFields('user:' + uid, ['fullname'], function(err, userData) {
							if (err || !userData || !userData.fullname) {
								return next(err);
							}

							db.setObjectField('fullname:uid', userData.fullname, uid, next);
						});
					}, function(err) {
						if (err) {
							winston.error('[2015/01/09] Error encountered while Creating fullname:uid hash');
							return next(err);
						}
						winston.info('[2015/01/09] Creating fullname:uid hash done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/09] Creating fullname:uid hash skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 13);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/13] Creating uid:followed_tids sorted set');

				db.getSortedSetRange('topics:tid', 0, -1, function(err, tids) {
					if (err) {
						winston.error('[2014/01/13] Error encountered while Creating uid:followed_tids sorted set');
						return next(err);
					}

					var now = Date.now();

					async.eachLimit(tids, 50, function(tid, next) {
						db.getSetMembers('tid:' + tid + ':followers', function(err, uids) {
							if (err) {
								return next(err);
							}

							async.eachLimit(uids, 50, function(uid, next) {
								if (parseInt(uid, 10)) {
									db.sortedSetAdd('uid:' + uid + ':followed_tids', now, tid, next);
								} else {
									next();
								}
							}, next);
						});
					}, function(err) {
						if (err) {
							winston.error('[2015/01/13] Error encountered while Creating uid:followed_tids sorted set');
							return next(err);
						}
						winston.info('[2015/01/13] Creating uid:followed_tids sorted set done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/13] Creating uid:followed_tids sorted set skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 14);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/14] Upgrading follow sets to sorted sets');

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if (err) {
						winston.error('[2014/01/14] Error encountered while Upgrading follow sets to sorted sets');
						return next(err);
					}

					var now = Date.now();

					async.eachLimit(uids, 50, function(uid, next) {
						async.parallel({
							following: function(next) {
								db.getSetMembers('following:' + uid, next);
							},
							followers: function(next) {
								db.getSetMembers('followers:' + uid, next);
							}
						}, function(err, results) {
							function updateToSortedSet(set, uids, callback) {
								async.eachLimit(uids, 50, function(uid, next) {
									if (parseInt(uid, 10)) {
										db.sortedSetAdd(set, now, uid, next);
									} else {
										next();
									}
								}, callback);
							}
							if (err) {
								return next(err);
							}

							async.parallel([
								async.apply(db.delete, 'following:' + uid),
								async.apply(db.delete, 'followers:' + uid)
							], function(err) {
								if (err) {
									return next(err);
								}
								async.parallel([
									async.apply(updateToSortedSet, 'following:' + uid, results.following),
									async.apply(updateToSortedSet, 'followers:' + uid, results.followers),
									async.apply(db.setObjectField, 'user:' + uid, 'followingCount', results.following.length),
									async.apply(db.setObjectField, 'user:' + uid, 'followerCount', results.followers.length),
								], next);
							});
						});
					}, function(err) {
						if (err) {
							winston.error('[2015/01/14] Error encountered while Upgrading follow sets to sorted sets');
							return next(err);
						}
						winston.info('[2015/01/14] Upgrading follow sets to sorted sets done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/14] Upgrading follow sets to sorted sets skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 15);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/15] Creating topiccount for users');

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if (err) {
						winston.error('[2015/01/15] Error encountered while Creating topiccount for users');
						return next(err);
					}

					async.eachLimit(uids, 50, function(uid, next) {
						db.sortedSetCard('uid:' + uid + ':topics', function(err, count) {
							if (err) {
								return next(err);
							}

							if (parseInt(count, 10)) {
								db.setObjectField('user:' + uid, 'topiccount', count, next);
							} else {
								next();
							}
						});
					}, function(err) {
						if (err) {
							winston.error('[2015/01/15] Error encountered while Creating topiccount for users');
							return next(err);
						}
						winston.info('[2015/01/15] Creating topiccount for users done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/15] Creating topiccount for users skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 19);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/19] Generating group slugs');

				async.waterfall([
					async.apply(db.getSetMembers, 'groups'),
					function(groups, next) {
						async.filter(groups, function(groupName, next) {
							db.getObjectField('group:' + groupName, 'hidden', function(err, hidden) {
								next((err || parseInt(hidden, 10)) ? false : true);
							});
						}, function(groups) {
							next(null, groups);
						});
					}
				], function(err, groups) {
					var tasks = [];
					groups.forEach(function(groupName) {
						tasks.push(async.apply(db.setObjectField, 'group:' + groupName, 'slug', Utils.slugify(groupName)));
						tasks.push(async.apply(db.setObjectField, 'groupslug:groupname', Utils.slugify(groupName), groupName));
					});

					// Administrator group
					tasks.push(async.apply(db.setObjectField, 'group:administrators', 'slug', 'administrators'));
					tasks.push(async.apply(db.setObjectField, 'groupslug:groupname', 'administrators', 'administrators'));

					async.parallel(tasks, function(err) {
						if (err) {
							winston.error('[2015/01/19] Error encountered while Generating group slugs');
							return next(err);
						}

						winston.info('[2015/01/19] Generating group slugs done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/19] Generating group slugs skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 21);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/21] Upgrading groups to sorted set');

				db.getSetMembers('groups', function(err, groupNames) {
					if (err) {
						return next(err);
					}

					var now = Date.now();
					async.each(groupNames, function(groupName, next) {
						db.getSetMembers('group:' + groupName + ':members', function(err, members) {
							if (err) {
								return next(err);
							}

							async.series([
								function(next) {
									if (members && members.length) {
										db.delete('group:' + groupName + ':members', function(err) {
											if (err) {
												return next(err);
											}
											var scores = members.map(function() {
												return now;
											});
											db.sortedSetAdd('group:' + groupName + ':members', scores, members, next);
										});
									} else {
										next();
									}
								},
								async.apply(db.sortedSetAdd, 'groups:createtime', now, groupName),
								async.apply(db.setObjectField, 'group:' + groupName, 'createtime', now)
							], next);
						});

					}, function(err) {
						winston.info('[2015/01/21] Upgrading groups to sorted set done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/21] Upgrading groups to sorted set skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 0, 30);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/01/30] Adding group member counts');

				db.getSortedSetRange('groups:createtime', 0, -1, function(err, groupNames) {
					if (err) {
						return next(err);
					}

					var now = Date.now();
					async.each(groupNames, function(groupName, next) {
						db.sortedSetCard('group:' + groupName + ':members', function(err, memberCount) {
							if (err) {
								return next(err);
							}

							if (parseInt(memberCount, 10)) {
								db.setObjectField('group:' + groupName, 'memberCount', memberCount, next);
							} else {
								next();
							}
						});
					}, function(err) {
						winston.info('[2015/01/30] Adding group member counts done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/01/30] Adding group member counts skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 1, 8);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/02/08] Clearing reset tokens');

				db.deleteAll(['reset:expiry', 'reset:uid'], function(err) {
					if (err) {
						winston.error('[2015/02/08] Error encountered while Clearing reset tokens');
						return next(err);
					}

					winston.info('[2015/02/08] Clearing reset tokens done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2015/02/08] Clearing reset tokens skipped');
				next();
			}
		}

		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 22!!!
	], function(err) {
		if (!err) {
			if(updatesMade) {
				winston.info('[upgrade] Schema update complete!');
			} else {
				winston.info('[upgrade] Schema already up to date!');
			}

			process.exit();
		} else {
			switch(err.message) {
			case 'upgrade-not-possible':
				winston.error('[upgrade] NodeBB upgrade could not complete, as your database schema is too far out of date.');
				winston.error('[upgrade]   Please ensure that you did not skip any minor version upgrades.');
				winston.error('[upgrade]   (e.g. v0.1.x directly to v0.3.x)');
				process.exit();
				break;

			default:
				winston.error('[upgrade] Errors were encountered while updating the NodeBB schema: ' + err.message);
				process.exit();
				break;
			}
		}
	});
};

module.exports = Upgrade;
