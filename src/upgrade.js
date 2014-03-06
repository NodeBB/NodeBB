"use strict";

var db = require('./database'),
	async = require('async'),
	winston = require('winston'),

	User = require('./user'),
	Topics = require('./topics'),
	Posts = require('./posts'),
	Categories = require('./categories'),
	Groups = require('./groups'),
	Meta = require('./meta'),
	Plugins = require('./plugins'),
	Utils = require('../public/src/utils'),

	Upgrade = {},

	minSchemaDate = Date.UTC(2014, 1, 14, 21, 50),		// This value gets updated every new MINOR version
	schemaDate, thisSchemaDate,

	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	latestSchema = Date.UTC(2014, 1, 22);

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
			thisSchemaDate = Date.UTC(2014, 1, 19, 18, 15);

			if (schemaDate < thisSchemaDate) {
				db.setObjectField('widgets:home.tpl', 'motd', JSON.stringify([
					{
						"widget": "html",
						"data": {
							"html": Meta.config['motd'] ||  "Welcome to NodeBB, if you are an administrator of this forum visit the <a target='_blank' href='/admin/themes'>Themes</a> ACP to modify and add widgets."
						}
					}
				]), function(err) {
					Meta.configs.remove('motd');
					Meta.configs.remove('motd_class');
					Meta.configs.remove('show_motd');

					winston.info('[2014/2/19] Updated MOTD to use the HTML widget.');

					if (err) {
						next(err);
					} else {
						Upgrade.update(thisSchemaDate, next);
					}
				});
			} else {
				winston.info('[2014/2/19] Updating MOTD to use the HTML widget - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 1, 20, 15, 30);

			if (schemaDate < thisSchemaDate) {
				var container = '<div class="panel panel-default"><div class="panel-heading">{title}</div><div class="panel-body">{body}</div></div>';

				db.setObjectField('widgets:category.tpl', 'sidebar', JSON.stringify([
					{
						"widget": "recentreplies",
						"data": {
							"title": "Recent Replies",
							"container": container
						}
					},
					{
						"widget": "activeusers",
						"data": {
							"title": "Active Users",
							"container": container
						}
					},
					{
						"widget": "moderators",
						"data": {
							"title": "Moderators",
							"container": container
						}
					}
				]), function(err) {
					winston.info('[2014/2/20] Adding Recent Replies, Active Users, and Moderator widgets to category sidebar.');

					if (err) {
						next(err);
					} else {
						Upgrade.update(thisSchemaDate, next);
					}
				});
			} else {
				winston.info('[2014/2/20] Adding Recent Replies, Active Users, and Moderator widgets to category sidebar - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 1, 20, 16, 15);

			if (schemaDate < thisSchemaDate) {
				db.setObjectField('widgets:home.tpl', 'footer', JSON.stringify([
					{
						"widget": "forumstats",
						"data": {}
					}
				]), function(err) {
					winston.info('[2014/2/20] Adding Forum Stats Widget to the Homepage Footer.');

					if (err) {
						next(err);
					} else {
						Upgrade.update(thisSchemaDate, next);
					}
				});
			} else {
				winston.info('[2014/2/20] Adding Forum Stats Widget to the Homepage Footer - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 1, 20, 19, 45);

			if (schemaDate < thisSchemaDate) {
				var container = '<div class="panel panel-default"><div class="panel-heading">{title}</div><div class="panel-body">{body}</div></div>';

				db.setObjectField('widgets:home.tpl', 'sidebar', JSON.stringify([
					{
						"widget": "html",
						"data": {
							"html": Meta.config['motd'] || "Welcome to NodeBB, if you are an administrator of this forum visit the <a target='_blank' href='/admin/themes'>Themes</a> ACP to modify and add widgets.",
							"container": container,
							"title": "MOTD"
						}
					}
				]), function(err) {
					winston.info('[2014/2/20] Updating Lavender MOTD');

					if (err) {
						next(err);
					} else {
						Upgrade.update(thisSchemaDate, next);
					}
				});
			} else {
				winston.info('[2014/2/20] Updating Lavender MOTD - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 1, 20, 20, 25);

			if (schemaDate < thisSchemaDate) {
				db.setAdd('plugins:active', 'nodebb-widget-essentials', function(err) {
					winston.info('[2014/2/20] Activating NodeBB Essential Widgets');
					Plugins.reload(function() {
						if (err) {
							next(err);
						} else {
							Upgrade.update(thisSchemaDate, next);
						}
					});
				});
			} else {
				winston.info('[2014/2/20] Activating NodeBB Essential Widgets - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 1, 22);

			if (schemaDate < thisSchemaDate) {
				db.exists('categories:cid', function(err, exists) {
					if(err) {
						return next(err);
					}
					if(!exists) {
						winston.info('[2014/2/22] Added categories to sorted set - skipped');
						return next();
					}

					db.getListRange('categories:cid', 0, -1, function(err, cids) {
						if(err) {
							return next(err);
						}

						if(!Array.isArray(cids)) {
							winston.info('[2014/2/22] Add categories to sorted set - skipped (cant find any cids)');
							return next();
						}

						db.rename('categories:cid', 'categories:cid:old', function(err) {
							if(err) {
								return next(err);
							}

							async.each(cids, function(cid, next) {
								Categories.getCategoryField(cid, 'order', function(err, order) {
									if(err) {
										return next(err);
									}

									// If there was no order present, put it at the end
									if (!order) {
										order = cids.length;
									}

									db.sortedSetAdd('categories:cid', order, cid, next);
								});
							}, function(err) {
								if(err) {
									return next(err);
								}
								winston.info('[2014/2/22] Added categories to sorted set');
								db.delete('categories:cid:old');
								Upgrade.update(thisSchemaDate, next);
							});
						});
					});
				});

			} else {
				winston.info('[2014/2/22] Added categories to sorted set - skipped');
				next();
			}
		}
		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 22!!!
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