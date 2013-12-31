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
	var	latestSchema = new Date(2013, 11, 31).getTime();

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
									newTitle = Utils.slugify(title);
									Topics.setTopicField(tid, 'title', newTitle, next);
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
									newUserSlug = Utils.slugify(username);
									User.setUserField(uid, 'userslug', newUserSlug, next);
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