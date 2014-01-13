"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	User = require('./user'),
	Topics = require('./topics'),
	Posts = require('./posts'),
	Groups = require('./groups'),
	Utils = require('../public/src/utils'),

	Upgrade = {},

	schemaDate, thisSchemaDate;

Upgrade.check = function(callback) {
	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	var	latestSchema = new Date(2014, 0, 13, 12, 0).getTime();

	db.get('schemaDate', function(err, value) {
		if (parseInt(value, 10) >= latestSchema) {
			callback(true);
		} else {
			callback(false);
		}
	});
};

Upgrade.upgrade = function(callback) {
	var updatesMade = false;

	winston.info('Beginning database schema update');

	async.series([
		function(next) {
			db.get('schemaDate', function(err, value) {
				schemaDate = value;
				next();
			});
		},
		function(next) {
			thisSchemaDate = new Date(2013, 11, 31).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				async.parallel([
					function(next) {
						// Re-slugify all topics
						db.getSortedSetRange('topics:recent', 0, -1, function(err, tids) {
							var	newTitle;

							async.each(tids, function(tid, next) {
								Topics.getTopicField(tid, 'title', function(err, title) {
									newTitle = tid + '/' + Utils.slugify(title);
									Topics.setTopicField(tid, 'slug', newTitle, next);
								});
							}, function(err) {
								next(err);
							});
						});
					},
					function(next) {
						// Re-slugify all users
						db.getObjectValues('username:uid', function(err, uids) {
							var	newUserSlug;

							async.each(uids, function(uid, next) {
								User.getUserField(uid, 'username', function(err, username) {
									if(err) {
										return next(err);
									}
									if(username) {
										newUserSlug = Utils.slugify(username);
										User.setUserField(uid, 'userslug', newUserSlug, next);
									} else {
										winston.warn('uid '+ uid + ' doesn\'t have a valid username (' + username + '), skipping');
										next(null);
									}
								});
							}, function(err) {
								next(err);
							});
						});
					}
				], function(err) {
					winston.info('[2013/12/31] Re-slugify Topics and Users');
					next(err);
				});
			} else {
				winston.info('[2013/12/31] Re-slugify Topics and Users skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 1).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.isObjectField('config', 'maximumTitleLength', function(err, isField) {
					if(err) {
						return next(err);
					}
					if(!isField) {
						db.setObjectField('config', 'maximumTitleLength', 255, function(err) {
							if(err) {
								return next(err);
							}
							winston.info('[2013/12/31] Added maximumTitleLength');
							next();
						});
					} else {
						winston.info('[2013/12/31] maximumTitleLength already set');
						next();
					}
				});
			} else {
				winston.info('[2013/12/31] maximumTitleLength skipped');
				next();
			}
		},
		function(next) {
			// Custom classes for each category, adding link field for each category
			thisSchemaDate = new Date(2014, 0, 3).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.getListRange('categories:cid', 0, -1, function(err, cids) {
					if(err) {
						return next(err);
					}

					for (var cid in cids) {
						db.setObjectField('category:' + cids[cid], 'link', '');
						db.setObjectField('category:' + cids[cid], 'class', 'col-md-3 col-xs-6');
					}

					winston.info('[2014/1/3] Added categories.class, categories.link fields');
					next();
				});
			} else {
				winston.info('[2014/1/3] categories.class, categories.link fields skipped');
				next();
			}
		},
		function(next) {
			// Custom classes for each category, adding link field for each category
			thisSchemaDate = new Date(2014, 0, 4).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.getListRange('categories:cid', 0, -1, function(err, cids) {
					if(err) {
						return next(err);
					}

					for (var cid in cids) {
						db.setObjectField('category:' + cids[cid], 'numRecentReplies', '2');
					}

					winston.info('[2014/1/4] Added categories.numRecentReplies fields');
					next();
				});
			} else {
				winston.info('[2014/1/4] categories.numRecentReplies fields skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 5).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.getListRange('categories:cid', 0, -1, function(err, cids) {
					if(err) {
						return next(err);
					}

					var timestamp = Date.now();

					function upgradeCategory(cid, next) {
						db.getSetMembers('cid:' + cid + ':active_users', function(err, uids) {
							if(err) {
								return next(err);
							}

							db.delete('cid:' + cid + ':active_users', function(err) {
								if(err) {
									return next(err);
								}

								for(var i=0; i<uids.length; ++i) {
									db.sortedSetAdd('cid:' + cid + ':active_users', timestamp, uids[i]);
								}
								next();
							});
						});
					}

					async.each(cids, upgradeCategory, function(err) {
						if(err) {
							return next(err);
						}
						winston.info('[2014/1/5] Upgraded categories active users');
						next();
					});
				});
			} else {
				winston.info('[2014/1/5] categories active users skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 5, 14, 6).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				// Re-slugify all users
				db.delete('userslug:uid', function(err) {
					if (!err) {
						db.getObjectValues('username:uid', function(err, uids) {
							var	newUserSlug;

							async.each(uids, function(uid, next) {
								User.getUserField(uid, 'username', function(err, username) {
									if(err) {
										return next(err);
									}
									if(username) {
										newUserSlug = Utils.slugify(username);
										async.parallel([
											function(next) {
												User.setUserField(uid, 'userslug', newUserSlug, next);
											},
											function(next) {
												db.setObjectField('userslug:uid', newUserSlug, uid, next);
											}
										], next);
									} else {
										winston.warn('uid '+ uid + ' doesn\'t have a valid username (' + username + '), skipping');
										next(null);
									}
								});
							}, function(err) {
								winston.info('[2014/1/5] Re-slugify usernames (again)');
								next(err);
							});
						});
					}
				});
			} else {
				winston.info('[2014/1/5] Re-slugify usernames (again) skipped');
				next();
			}
		},
		function(next) {
			function upgradeUserPostsTopics(next) {

				function upgradeUser(uid, next) {

					function upgradeUserPosts(next) {

						function addPostToUser(pid) {
							Posts.getPostField(pid, 'timestamp', function(err, timestamp) {
								db.sortedSetAdd('uid:' + uid + ':posts', timestamp, pid);
							});
						}

						db.getListRange('uid:' + uid + ':posts', 0, -1, function(err, pids) {
							if(err) {
								return next(err);
							}

							if(!pids || !pids.length) {
								return next();
							}

							db.delete('uid:' + uid + ':posts', function(err) {
								for(var i = 0; i< pids.length; ++i)	{
									addPostToUser(pids[i]);
								}
								next();
							});
						});
					}

					function upgradeUserTopics(next) {

						function addTopicToUser(tid) {
							Topics.getTopicField(tid, 'timestamp', function(err, timestamp) {
								db.sortedSetAdd('uid:' + uid + ':topics', timestamp, tid);
							});
						}

						db.getListRange('uid:' + uid + ':topics', 0, -1, function(err, tids) {
							if(err) {
								return next(err);
							}

							if(!tids || !tids.length) {
								return next();
							}

							db.delete('uid:' + uid + ':topics', function(err) {
								for(var i = 0; i< tids.length; ++i)	{
									addTopicToUser(tids[i]);
								}
								next();
							});
						});
					}

					async.series([upgradeUserPosts, upgradeUserTopics], function(err, result) {
						next(err);
					});
				}


				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if(err) {
						return next(err);
					}

					async.each(uids, upgradeUser, function(err, result) {
						next(err);
					});
				});
			}

			function upgradeTopicPosts(next) {
				function upgradeTopic(tid, next) {
					function addPostToTopic(pid) {
						Posts.getPostField(pid, 'timestamp', function(err, timestamp) {
							db.sortedSetAdd('tid:' + tid + ':posts', timestamp, pid);
						});
					}

					db.getListRange('tid:' + tid + ':posts', 0, -1, function(err, pids) {
						if(err) {
							return next(err);
						}

						if(!pids || !pids.length) {
							return next();
						}

						db.delete('tid:' + tid + ':posts', function(err) {
							for(var i = 0; i< pids.length; ++i) {
								addPostToTopic(pids[i]);
							}
							next();
						});
					});
				}

				db.getSetMembers('topics:tid', function(err, tids) {
					async.each(tids, upgradeTopic, function(err, results) {
						next(err);
					});
				});
			}

			thisSchemaDate = new Date(2014, 0, 7).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				async.series([upgradeUserPostsTopics, upgradeTopicPosts], function(err, results) {
					if(err) {
						winston.err('Error upgrading '+ err.message);
						return next(err);
					}

					winston.info('[2014/1/7] Updated topic and user posts to sorted set');
					next();
				});

			} else {
				winston.info('[2014/1/7] Update to topic and user posts to sorted set skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 13, 12, 0).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.getObjectValues('username:uid', function(err, uids) {
					console.log(uids);
					async.eachSeries(uids, function(uid, next) {
						Groups.joinByGroupName('registered-users', uid, next);
					}, function(err) {
						if(err) {
							winston.err('Error upgrading '+ err.message);
							process.exit();
						} else {
							winston.info('[2014/1/13] Set up "Registered Users" user group');
							next();
						}
					});
				});
			} else {
				winston.info('[2014/1/13] Set up "Registered Users" user group - skipped');
				next();
			}
		}
		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 17!!!
	], function(err) {
		if (!err) {
			db.set('schemaDate', thisSchemaDate, function(err) {
				if (!err) {
					if(updatesMade) {
						winston.info('[upgrade] Schema update complete!');
					} else {
						winston.info('[upgrade] Schema already up to date!');
					}
					if (callback) {
						callback(err);
					} else {
						process.exit();
					}
				} else {
					winston.error('[upgrade] Could not update NodeBB schema data!');
					process.exit();
				}
			});
		} else {
			winston.error('[upgrade] Errors were encountered while updating the NodeBB schema: ' + err.message);
			process.exit();
		}
	});
};

module.exports = Upgrade;