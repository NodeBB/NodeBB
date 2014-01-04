"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	User = require('./user'),
	Topics = require('./topics'),
	Utils = require('../public/src/utils'),

	Upgrade = {},

	schemaDate, thisSchemaDate;

Upgrade.check = function(callback) {
	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	var	latestSchema = new Date(2014, 0, 5).getTime();

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
							return next(err)
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