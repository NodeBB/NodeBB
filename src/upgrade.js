"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	User = require('./user'),
	Topics = require('./topics'),
	Posts = require('./posts'),
	Groups = require('./groups'),
	Meta = require('./meta'),
	Plugins = require('./plugins'),
	Utils = require('../public/src/utils'),

	Upgrade = {},

	minSchemaDate = new Date(2014, 0, 4).getTime(),		// This value gets updated every new MINOR version
	schemaDate, thisSchemaDate;

Upgrade.check = function(callback) {
	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	var	latestSchema = new Date(2014, 1, 14, 21, 50).getTime();

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
			// Prepare for upgrade & check to make sure the upgrade is possible
			db.get('schemaDate', function(err, value) {
				schemaDate = value;

				if (schemaDate >= minSchemaDate || schemaDate === null) {
					next();
				} else {
					next(new Error('upgrade-not-possible'));
				}
			});
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
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 19, 22, 19).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.getObjectValues('username:uid', function(err, uids) {
					async.each(uids, function(uid, next) {
						db.searchRemove('user', uid, next);
					}, function(err) {
						winston.info('[2014/1/19] Remove user search from Reds');
						next();
					});
				});
			} else {
				winston.info('[2014/1/19] Remove user search from Reds -- skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 23, 16, 5).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				Groups.getByGroupName('Administrators', {}, function(err, groupObj) {
					if (err && err.message === 'gid-not-found') {
						winston.info('[2014/1/23] Updating Administrators Group -- skipped');
						return next();
					}

					Groups.update(groupObj.gid, {
						name: 'administrators',
						hidden: '1'
					}, function() {
						winston.info('[2014/1/23] Updating Administrators Group');
						next();
					});
				});
			} else {
				winston.info('[2014/1/23] Updating Administrators Group -- skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 25, 0, 0).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if(err) {
						return next(err);
					}

					if(!uids || !uids.length) {
						winston.info('[2014/1/25] Updating User Gravatars to HTTPS  -- skipped');
						return next();
					}

					var gravatar = require('gravatar');

					function updateGravatar(uid, next) {
						User.getUserFields(uid, ['email', 'picture', 'gravatarpicture'], function(err, userData) {
							var gravatarPicture = User.createGravatarURLFromEmail(userData.email);
							if(userData.picture === userData.gravatarpicture) {
								User.setUserField(uid, 'picture', gravatarPicture);
							}
							User.setUserField(uid, 'gravatarpicture', gravatarPicture, next);
						});
					}

					winston.info('[2014/1/25] Updating User Gravatars to HTTPS');
					async.each(uids, updateGravatar, next);
				});
			} else {
				winston.info('[2014/1/25] Updating User Gravatars to HTTPS -- skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 27, 12, 35).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				var	activations = [];

				if (Meta.config['social:facebook:secret'] && Meta.config['social:facebook:app_id']) {
					activations.push(function(next) {
						Plugins.toggleActive('nodebb-plugin-sso-facebook', function(result) {
							winston.info('[2014/1/25] Activating Facebook SSO Plugin');
							next();
						});
					});
				}
				if (Meta.config['social:twitter:key'] && Meta.config['social:twitter:secret']) {
					activations.push(function(next) {
						Plugins.toggleActive('nodebb-plugin-sso-twitter', function(result) {
							winston.info('[2014/1/25] Activating Twitter SSO Plugin');
							next();
						});
					});
				}
				if (Meta.config['social:google:secret'] && Meta.config['social:google:id']) {
					activations.push(function(next) {
						Plugins.toggleActive('nodebb-plugin-sso-google', function(result) {
							winston.info('[2014/1/25] Activating Google SSO Plugin');
							next();
						});
					});
				}

				async.parallel(activations, function(err) {
					if (!err) {
						winston.info('[2014/1/25] Done activating SSO plugins');
					}

					next(err);
				});
			} else {
				winston.info('[2014/1/25] Activating SSO plugins, if set up -- skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 30, 15, 0).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				if (Meta.config.defaultLang === 'en') {
					Meta.configs.set('defaultLang', 'en_GB', next);
				} else if (Meta.config.defaultLang === 'pt_br') {
					Meta.configs.set('defaultLang', 'pt_BR', next);
				} else if (Meta.config.defaultLang === 'zh_cn') {
					Meta.configs.set('defaultLang', 'zh_CN', next);
				} else if (Meta.config.defaultLang === 'zh_tw') {
					Meta.configs.set('defaultLang', 'zh_TW', next);
				} else {
					winston.info('[2014/1/30] Fixing language settings -- skipped');
					return next();
				}

				winston.info('[2014/1/30] Fixing language settings');
				next();
			} else {
				winston.info('[2014/1/30] Fixing language settings -- skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 0, 30, 16, 0).getTime();

			function updateTopic(tid, next) {
				Topics.getTopicFields(tid, ['postcount', 'viewcount'], function(err, topicData) {
					if(err) {
						next(err);
					}

					if(topicData) {
						if(!topicData.postcount) {
							topicData.postcount = 0;
						}

						if(!topicData.viewcount) {
							topicData.viewcount = 0;
						}

						db.sortedSetAdd('topics:posts', topicData.postcount, tid);
						db.sortedSetAdd('topics:views', topicData.viewcount, tid);
					}

					next();
				});
			}

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;



				winston.info('[2014/1/30] Adding new topic sets');
				db.getSortedSetRange('topics:recent', 0, -1, function(err, tids) {
					if(err) {
						return next(err);
					}

					async.each(tids, updateTopic, function(err) {
						next(err);
					});
				});


			} else {
				winston.info('[2014/1/30] Adding new topic sets -- skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 1, 2, 16, 0).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				winston.info('[2014/2/6] Upvoting all favourited posts for each user');

				User.getUsers('users:joindate', 0, -1, function (err, users) {
					function getFavourites(user, next) {
						function upvote(post, next) {
							var pid = post.pid,
								uid = user.uid;

							if (post.uid !== uid) {
								db.setAdd('pid:' + pid + ':upvote', uid);
								db.sortedSetAdd('uid:' + uid + ':upvote', post.timestamp, pid);
								db.incrObjectField('post:' + pid, 'votes');
							}

							next();
						}

						Posts.getFavourites(user.uid, 0, -1, function(err, posts) {
							async.each(posts.posts, upvote, function(err) {
								next(err);
							});
						});
					}
					async.each(users, getFavourites, function(err) {
						next(err);
					});
				});
			} else {
				winston.info('[2014/2/6] Upvoting all favourited posts for each user -- skipped');
				next();
			}
		},
		function(next) {

			thisSchemaDate = new Date(2014, 1, 7, 16, 0).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				winston.info('[2014/2/7] Updating category recent replies');
				db.getListRange('categories:cid', 0, -1, function(err, cids) {

					function updateCategory(cid, next) {
						db.getSortedSetRevRange('categories:recent_posts:cid:' + cid, 0, - 1, function(err, pids) {
							function updatePid(pid, next) {
								Posts.getCidByPid(pid, function(err, realCid) {
									if(err) {
										return next(err);
									}

									if(parseInt(realCid, 10) !== parseInt(cid, 10)) {
										Posts.getPostField(pid, 'timestamp', function(err, timestamp) {
											db.sortedSetRemove('categories:recent_posts:cid:' + cid, pid);
											db.sortedSetAdd('categories:recent_posts:cid:' + realCid, timestamp, pid);
											next();
										});
									} else {
										next();
									}
								});
							}

							async.each(pids, updatePid, next);
						});
					}

					if(err) {
						return next(err);
					}

					async.each(cids, updateCategory, next);
				});


			} else {
				winston.info('[2014/2/7] Updating category recent replies -- skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 1, 9, 20, 50).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.delete('tid:lastFeedUpdate', function(err) {
					if(err) {
						winston.err('Error upgrading '+ err.message);
						process.exit();
					} else {
						winston.info('[2014/2/9] Remove Topic LastFeedUpdate value, as feeds are now on-demand');
						next();
					}
				});
			} else {
				winston.info('[2014/2/9] Remove Topic LastFeedUpdate value, as feeds are now on-demand - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 1, 14, 20, 50).getTime();

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.exists('topics:tid', function(err, exists) {
					if(err) {
						return next(err);
					}
					if(!exists) {
						winston.info('[2014/2/14] Upgraded topics to sorted set - skipped');
						return next();
					}
					db.getSetMembers('topics:tid', function(err, tids) {
						if(err) {
							return next(err);
						}

						db.rename('topics:tid', 'topics:tid:old', function(err) {
							if(err) {
								return next(err);
							}

							async.each(tids, function(tid, next) {
								Topics.getTopicField(tid, 'timestamp', function(err, timestamp) {
									db.sortedSetAdd('topics:tid', timestamp, tid, next);
								});
							}, function(err) {
								if(err) {
									return next(err);
								}
								winston.info('[2014/2/14] Upgraded topics to sorted set');
								db.delete('topics:tid:old', next);
							});
						});
					});
				});
			} else {
				winston.info('[2014/2/14] Upgrade topics to sorted set - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = new Date(2014, 1, 14, 21, 50).getTime();

			if (schemaDate < thisSchemaDate) {
				updatesMade = true;

				db.exists('users:joindate', function(err, exists) {
					if(err) {
						return next(err);
					}
					if(!exists) {
						winston.info('[2014/2/14] Added posts to sorted set - skipped');
						return next();
					}

					db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
						if(err) {
							return next(err);
						}

						async.each(uids, function(uid, next) {
							User.getPostIds(uid, 0, -1, function(err, pids) {
								if(err) {
									return next(err);
								}

								async.each(pids, function(pid, next) {
									Posts.getPostField(pid, 'timestamp', function(err, timestamp) {
										if(err) {
											return next(err);
										}
										db.sortedSetAdd('posts:pid', timestamp, pid, next);
									});
								}, next);
							});
						}, function(err) {
							if(err) {
								return next(err);
							}

							winston.info('[2014/2/14] Added posts to sorted set');
							next();
						});
					});
				});

			} else {
				winston.info('[2014/2/14] Added posts to sorted set - skipped');
				next();
			}
		},
		function(next) {
			var	checkDate = Date.UTC(2014, 1, 14, 21, 50);

			if (schemaDate < checkDate) {
				thisSchemaDate = checkDate;
				updatesMade = true;

				winston.info('[2014/2/14] Migrating to UTC schemaDate');
				next();
			} else {
				winston.info('[2014/2/14] Migrating to UTC schemaDate -- skipped');
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