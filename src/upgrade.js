"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	User = require('./user'),
	Topics = require('./topics'),
	Utils = require('../public/src/utils'),
	notifications = require('./notifications'),
	categories = require('./categories'),

	Upgrade = {},

	schemaDate, thisSchemaDate;

Upgrade.check = function(callback) {
	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	var	latestSchema = new Date(2014, 0, 4).getTime();

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
			thisSchemaDate = new Date(2013, 9, 3).getTime();
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				async.series([
					function(next) {
						db.keys('uid:*:notifications:flag', function(err, keys) {
							if (keys.length > 0) {
								winston.info('[2013/10/03] Removing deprecated Notification Flags');
								async.each(keys, function(key, next) {
									db.delete(key, next);
								}, next);
							} else {
								winston.info('[2013/10/03] No Notification Flags found. Good.');
								next();
							}
						});
					},
					function(next) {
						winston.info('[2013/10/03] Updating Notifications');
						db.keys('uid:*:notifications:*', function(err, keys) {
							async.each(keys, function(key, next) {
								db.getSortedSetRange(key, 0, -1, function(err, nids) {
									async.each(nids, function(nid, next) {
										notifications.get(nid, null, function(notif_data) {
											if (notif_data) {
												db.sortedSetAdd(key, notif_data.datetime, nid, next);
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
						db.keys('notifications:*', function(err, keys) {
							if (keys.length > 0) {
								winston.info('[2013/10/03] Removing Notification Scores');
								async.each(keys, function(key, next) {
									if (key === 'notifications:next_nid') {
										return next();
									}

									db.deleteObjectField(key, 'score', next);
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
				db.keys('notifications:*', function(err, keys) {

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
							db.setAdd('notifications', key, cb);
						}, next);
					} else {
						next();
					}

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
				db.setObjectField('config', 'postDelay', 10, function(err, success) {
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
				db.keys('category:*', function(err, categories) {
					async.each(categories, function(categoryStr, next) {
						var	hex;
						db.getObject(categoryStr, function(err, categoryObj) {
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

							db.setObjectField(categoryStr, 'bgColor', hex, next);
							db.deleteObjectField(categoryStr, 'blockclass');
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

						db.setObjectField('category:' + category.cid, 'icon', icon, next);
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
				db.get(key, function(err, value) {
					if(err) {
						return next(err);
					}

					if(value === null) {
						db.setObjectField('global', newKeys[key], initialValues[key], next);
					} else {
						db.setObjectField('global', newKeys[key], value, next);
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

					winston.info('[2013/12/31] Added categories.class, categories.link fields');
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

					winston.info('[2013/12/31] Added categories.numRecentReplies fields');
					next();
				});
			} else {
				winston.info('[2014/1/3] categories.numRecentReplies fields skipped');
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