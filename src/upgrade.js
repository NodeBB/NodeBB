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
	latestSchema = Date.UTC(2014, 2, 19, 20);

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
						// Naive type-checking, becaue DBAL does not have .type() support
						if(err) {
							// Most likely upgraded already. Skip.
							winston.info('[2014/2/22] Added categories to sorted set - skipped');
							return Upgrade.update(thisSchemaDate, next);
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
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 2, 18);

			if (schemaDate < thisSchemaDate) {
				db.exists('settings:markdown', function(err, exists) {
					if (err || exists) {
						winston.info('[2014/3/18] Migrating Markdown settings to new configuration - skipped');
						return next();
					}

					var	fields = [
							'nodebb-plugin-markdown:options:gfm',
							'nodebb-plugin-markdown:options:highlight',
							'nodebb-plugin-markdown:options:tables',
							'nodebb-plugin-markdown:options:breaks',
							'nodebb-plugin-markdown:options:pedantic',
							'nodebb-plugin-markdown:options:sanitize',
							'nodebb-plugin-markdown:options:smartLists',
							'nodebb-plugin-markdown:options:smartypants',
							'nodebb-plugin-markdown:options:langPrefix'
						],
						settings = {},
						newFieldName;

					async.series([
						function(next) {
							db.getObjectFields('config', fields, function(err, values) {
								if (err) {
									return next();
								}

								for(var field in values) {
									if (values.hasOwnProperty(field)) {
										newFieldName = field.slice(31);
										settings[newFieldName] = values[field] === '1' ? 'on' : values[field];
									}
								}

								next();
							});
						},
						function(next) {
							db.setObject('settings:markdown', settings, next);
						},
						function(next) {
							async.each(fields, function(field, next) {
								db.deleteObjectField('config', field, next);
							}, next);
						}
					], function(err) {
						if (err) {
							winston.error('[2014/3/18] Problem migrating Markdown settings.');
							next();
						} else {
							winston.info('[2014/3/18] Migrated Markdown settings to new configuration');
							Upgrade.update(thisSchemaDate, next);
						}
					});
				});
			} else {
				winston.info('[2014/3/18] Migrating Markdown settings to new configuration - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 2, 19, 20);

			if (schemaDate < thisSchemaDate) {
				db.getObject('group:gid', function(err, mapping) {
					if (err) {
						return next(err);
					}

					if (!err && !mapping) {
						// Done already, skip
						return next();
					}

					var	names = Object.keys(mapping);
					async.each(names, function(name, next) {
						async.series([
							function(next) {
								// Remove the gid from the hash
								db.deleteObjectField('gid:' + mapping[name], 'gid', next);
							},
							function(next) {
								db.rename('gid:' + mapping[name], 'group:' + name, next);
							},
							function(next) {
								db.exists('gid:' + mapping[name] + ':members', function(err, exists) {
									if (err) {
										return next(err);
									}

									if (exists) {
										db.rename('gid:' + mapping[name] + ':members', 'group:' + name + ':members', next);
									} else {
										// No members, do nothing
										next();
									}
								});
							},
							function(next) {
								// Add groups to a directory (set)
								db.setAdd('groups', name, next);
							}
						], next);
					}, function(err) {
						// Clean-up
						async.series([
							function(next) {
								// Mapping
								db.delete('group:gid', next);
							},
							function(next) {
								// Incrementor
								db.deleteObjectField('global', 'nextGid', next);
							},
							function(next) {
								// Set 'administrators' and 'registered-users' as system groups
								db.setObjectField('group:administrators', 'system', '1');
								db.setObjectField('group:registered-users', 'system', '1');
								next();
							},
							function(next) {
								// Delete empty groups
								Groups.list({ showAllGroups: true }, function(err, groups) {
									async.each(groups, function(group, next) {
										if (group.members.length === 0) {
											// Delete the group
											Groups.destroy(group.name, next);
										} else {
											next();
										}
									}, next);
								});
							}
						], function(err) {
							console.log('so far so good');
							process.exit();
						});
					});
				});
			} else {
				winston.info('[2014/3/19] Removing gids and pruning groups - skipped');
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