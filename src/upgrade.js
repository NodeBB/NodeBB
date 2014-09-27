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
	latestSchema = Date.UTC(2014, 8, 27);

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
							"html": Meta.config.motd ||  "Welcome to NodeBB, if you are an administrator of this forum visit the <a target='_blank' href='/admin/themes'>Themes</a> ACP to modify and add widgets."
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
							"html": Meta.config.motd || "Welcome to NodeBB, if you are an administrator of this forum visit the <a target='_blank' href='/admin/themes'>Themes</a> ACP to modify and add widgets.",
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
			thisSchemaDate = Date.UTC(2014, 2, 21);

			if (schemaDate < thisSchemaDate) {
				db.getObject('group:gid', function(err, mapping) {
					if (err) {
						return next(err);
					}

					if (!err && !mapping) {
						// Done already, skip
						return next();
					}

					var	names = Object.keys(mapping),
						reverseMapping = {},
						isGroupList = /^cid:[0-9]+:privileges:g\+[rw]$/,
						gid;

					for(var groupName in mapping) {
						gid = mapping[groupName];
						if (mapping.hasOwnProperty(groupName) && !reverseMapping.hasOwnProperty(gid)) {
							reverseMapping[parseInt(gid, 10)] = groupName;
						}
					}

					async.eachSeries(names, function(name, next) {
						async.series([
							function(next) {
								// Remove the gid from the hash
								db.exists('gid:' + mapping[name], function(err, exists) {
									if (exists) {
										db.deleteObjectField('gid:' + mapping[name], 'gid', next);
									} else {
										next();
									}
								});
							},
							function(next) {
								// Rename gid hash to groupName hash
								db.exists('gid:' + mapping[name], function(err, exists) {
									if (exists) {
										db.rename('gid:' + mapping[name], 'group:' + name, next);
									} else {
										next();
									}
								});
							},
							function(next) {
								// Move member lists over
								db.exists('gid:' + mapping[name], function(err, dstExists) {
									if (err) {
										return next(err);
									}

									db.exists('gid:' + mapping[name] + ':members', function(err, srcExists) {
										if (err) {
											return next(err);
										}

										if (srcExists && !dstExists) {
											db.rename('gid:' + mapping[name] + ':members', 'group:' + name + ':members', next);
										} else {
											// No members or group memberlist collision: do nothing, they'll be removed later
											next();
										}
									});
								});
							},
							function(next) {
								// Add group to the directory (set)
								db.setAdd('groups', name, next);
							},
							function(next) {
								// If this group contained gids, map the gids to group names
								// Also check if the mapping and reverseMapping still work, if not, delete this group
								if (isGroupList.test(name) && name === reverseMapping[mapping[name]]) {
									db.getSetMembers('group:' + name + ':members', function(err, gids) {
										async.each(gids, function(gid, next) {
											db.setRemove('group:' + name + ':members', gid);
											db.setAdd('group:' + name + ':members', reverseMapping[gid], next);
										}, next);
									});
								} else if (name !== reverseMapping[mapping[name]]) {
									async.parallel([
										function(next) {
											db.delete('group:' + name, next);
										},
										function(next) {
											db.delete('group:' + name + ':members', next);
										},
										function(next) {
											db.setRemove('groups', name, next);
										}
									], next);
								} else {
									next();
								}
							},
							function(next) {
								// Fix its' name, if it is wrong for whatever reason
								db.getObjectField('group:' + name, 'name', function(err, groupName) {
									if (name && groupName && name !== groupName) {
										async.series([
											function(cb) {
												db.setObjectField('group:' + name, 'name', name, cb);
											},
											function(cb) {
												db.setRemove('groups', groupName, cb);
											},
											function(cb) {
												db.setAdd('groups', name, cb);
											}
										], next);
									} else {
										next();
									}
								});
							}
						], next);
					}, function(err) {
						if (err) {
							winston.error('[2014/3/21] Problem removing gids and pruning groups.');
							winston.error(err.message);
							return next();
						}

						// Clean-up
						var	isValidHiddenGroup = /^cid:[0-9]+:privileges:(g)?\+[rw]$/;
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
								async.parallel([
									function(next) {
										db.setObject('group:administrators', {
											system: '1',
											hidden: '0'
										}, next);
									},
									function(next) {
										db.setObject('group:registered-users', {
											system: '1',
											hidden: '0'
										}, next);
									}
								], next);
							},
							function(next) {
								Groups.list({ showAllGroups: true }, function(err, groups) {
									async.each(groups, function(group, next) {
										// If deleted, (hidden & empty), or invalidly named hidden group, delete
										if (group.deleted || (group.hidden && group.memberCount === 0) || (group.hidden && !isValidHiddenGroup.test(group.name))) {
											Groups.destroy(group.name, next);
										} else {
											next();
										}
									}, next);
								});
							}
						], function(err) {
							if (err) {
								winston.error('[2014/3/21] Problem removing gids and pruning groups.');
								next();
							} else {
								winston.info('[2014/3/21] Removing gids and pruning groups');
								Upgrade.update(thisSchemaDate, next);
							}
						});
					});
				});
			} else {
				winston.info('[2014/3/21] Removing gids and pruning groups - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 3, 31, 12, 30);

			if (schemaDate < thisSchemaDate) {
				db.setObjectField('widgets:global', 'footer', "[{\"widget\":\"html\",\"data\":{\"html\":\"<footer id=\\\"footer\\\" class=\\\"container footer\\\">\\r\\n\\t<div class=\\\"copyright\\\">\\r\\n\\t\\tCopyright © 2014 <a target=\\\"_blank\\\" href=\\\"https://www.nodebb.com\\\">NodeBB Forums</a> | <a target=\\\"_blank\\\" href=\\\"//github.com/NodeBB/NodeBB/graphs/contributors\\\">Contributors</a>\\r\\n\\t</div>\\r\\n</footer>\",\"title\":\"\",\"container\":\"\"}}]", function(err) {
					if (err) {
						winston.error('[2014/3/31] Problem re-adding copyright message into global footer widget');
						next();
					} else {
						winston.info('[2014/3/31] Re-added copyright message into global footer widget');
						Upgrade.update(thisSchemaDate, next);
					}
				});
			} else {
				winston.info('[2014/3/31] Re-adding copyright message into global footer widget - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 4, 1);

			if (schemaDate < thisSchemaDate) {
				db.getObjectField('widgets:home.tpl', 'sidebar', function(err, widgetData) {
					if (err) {
						winston.error('[2014/4/1] Error moving home sidebar widgets into draft zone');
						return next(err);
					}

					db.setObjectField('widgets:global', 'drafts', widgetData, function(err) {
						if (err) {
							winston.error('[2014/4/1] Error moving home sidebar widgets into draft zone');
							return next(err);
						}

						db.deleteObjectField('widgets:home.tpl', 'sidebar', function(err) {
							if (err) {
								winston.error('[2014/4/1] Error moving home sidebar widgets into draft zone');
								next(err);
							} else {
								winston.info('[2014/4/1] Moved home sidebar widgets into draft zone');
								Upgrade.update(thisSchemaDate, next);
							}
						});
					});
				});
			} else {
				winston.info('[2014/4/1] Moved home sidebar widgets into draft zone - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 4, 2);

			if (schemaDate < thisSchemaDate) {
				db.getObjectField('widgets:home.tpl', 'footer', function(err, widgetData) {
					if (err) {
						winston.error('[2014/4/1] Error moving deprecated vanilla footer widgets into draft zone');
						return next(err);
					}

					db.setObjectField('widgets:global', 'drafts', widgetData, function(err) {
						if (err) {
							winston.error('[2014/4/1] Error moving deprecated vanilla footer widgets into draft zone');
							return next(err);
						}

						db.deleteObjectField('widgets:home.tpl', 'footer', function(err) {
							if (err) {
								winston.error('[2014/4/1] Error moving deprecated vanilla footer widgets into draft zone');
								next(err);
							} else {
								winston.info('[2014/4/1] Moved deprecated vanilla footer widgets into draft zone');
								Upgrade.update(thisSchemaDate, next);
							}
						});
					});
				});
			} else {
				winston.info('[2014/4/2] Moved deprecated vanilla footer widgets into draft zone - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 4, 13);

			if (schemaDate < thisSchemaDate) {
				var tasks = [];
				db.getSetMembers('groups', function(err, groups) {
					var	isCidPerm = /^cid:\d+:privileges:g?\+[rw]$/,
						privMap = {
							"+r": "read",
							"+w": "topics:create",
							"g+r": "groups:read",
							"g+w": "groups:topics:create"
						};

					groups = groups.filter(function(groupName) {
						return isCidPerm.test(groupName);
					});

					groups.forEach(function(groupName) {
						var	split = groupName.split(':'),
							privilege = split.pop(),
							newPrivilege = privMap[privilege],
							newName;

						split.push(newPrivilege);
						newName = split.join(':');

						tasks.push(async.apply(db.rename, 'group:' + groupName, 'group:' + newName));
						tasks.push(async.apply(db.rename, 'group:' + groupName + ':members', 'group:' + newName + ':members'));
						tasks.push(async.apply(db.setRemove, 'groups', groupName));
						tasks.push(async.apply(db.setAdd, 'groups', newName));
					});

					async.parallel(tasks, function(err) {
						if (!err) {
							winston.info('[2014/4/1] Updating privilege settings');
							Upgrade.update(thisSchemaDate, next);
						} else {
							winston.error('[2014/4/1] Error encountered while updating privilege settings');
							next(err);
						}
					});
				});
			} else {
				winston.info('[2014/5/13] Updating privilege settings - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 4, 16);

			if (schemaDate < thisSchemaDate) {
				var tasks = [];

				db.getObjectField('config', 'allowGuestPosting', function(err, value) {
					if (value === '1') {
						tasks.push(async.apply(db.deleteObjectField, 'config', 'allowGuestPosting'));

						db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
							async.each(cids, function(cid, next) {
								Categories.getCategoryField(cid, 'disabled', function(err, disabled) {
									if (!disabled || disabled === '0') {
										tasks.push(async.apply(Groups.join, 'cid:' + cid + ':privileges:groups:topics:create', 'guests'));
										tasks.push(async.apply(Groups.join, 'cid:' + cid + ':privileges:groups:topics:reply', 'guests'));
										next();
									} else {
										next();
									}
								});
							}, function() {
								async.parallel(tasks, function(err) {
									if (!err) {
										winston.info('[2014/5/16] Removing allowGuestPosting option');
										Upgrade.update(thisSchemaDate, next);
									} else {
										winston.error('[2014/4/1] Error encountered while removing allowGuestPosting option');
										next(err);
									}
								});
							});
						});
					} else {
						winston.info('[2014/5/16] Removing allowGuestPosting option - skipped');
						next();
					}
				});
			} else {
				winston.info('[2014/5/16] Removing allowGuestPosting option - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 4, 22);

			if (schemaDate < thisSchemaDate) {
				db.exists('tags', function(err, exists) {
					if (err || !exists) {
						winston.info('[2014/5/22] Skipping tag upgrade');
						return Upgrade.update(thisSchemaDate, next);
					}

					db.getSetMembers('tags', function(err, tags) {
						if (err) {
							return next(err);
						}

						async.each(tags, function(tag, next) {
							db.sortedSetCard('tag:' + tag + ':topics', function(err, count) {
								if (err) {
									return next(err);
								}
								db.sortedSetAdd('tags:topic:count', count, tag, next);
							});
						}, function(err) {
							if (err) {
								winston.error('[2014/5/22] Error encountered while upgrading tags');
								return next(err);
							}

							db.delete('tags', function(err) {
								if (err) {
									winston.error('[2014/5/22] Error encountered while upgrading tags');
									return next(err);
								}
								winston.info('[2014/5/22] Tags upgraded to sorted set');
								Upgrade.update(thisSchemaDate, next);
							});
						});
					});
				});
			} else {
				winston.info('[2014/5/16] Tags upgrade - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 5, 6);

			if (schemaDate < thisSchemaDate) {
				winston.info('[2014/6/6] Upgrading topics...');

				db.getSortedSetRange('topics:tid', 0, -1, function(err, tids) {
					function upgradeTopic(tid, callback) {

						Topics.getTopicField(tid, 'mainPid', function(err, mainPid) {
							if (err) {
								return callback(err);
							}

							db.getSortedSetRange('tid:' + tid + ':posts', 0, -1, function(err, pids) {
								if (err) {
									return callback(err);
								}

								if (!Array.isArray(pids) || !pids.length) {
									return callback();
								}

								if (!parseInt(mainPid, 10)) {
									mainPid = pids[0];
									pids.splice(0, 1);
									Topics.setTopicField(tid, 'mainPid', mainPid);
									db.sortedSetRemove('tid:' + tid + ':posts', mainPid);
									db.sortedSetRemove('tid:' + tid + ':posts:votes', mainPid);
								}

								if (!pids.length) {
									return callback();
								}

								async.eachLimit(pids, 10, function(pid, next) {
									Posts.getPostField(pid, 'votes', function(err, votes) {
										if (err) {
											return next(err);
										}
										db.sortedSetAdd('tid:' + tid + ':posts:votes', votes ? votes : 0, pid, next);
									});
								}, callback);
							});
						});
					}

					if (err) {
						return next(err);
					}

					if (!Array.isArray(tids) || !tids.length)  {
						winston.info('[2014/6/6] Skipping topic upgrade');
						return Upgrade.update(thisSchemaDate, next);
					}

					async.eachLimit(tids, 10, upgradeTopic, function(err) {
						if (err) {
							winston.error('[2014/6/6] Error encountered while upgrading topics');
							return next(err);
						}
						winston.info('[2014/6/6] Topics upgraded.');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2014/6/6] Topic upgrade - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 5, 17);

			if (schemaDate < thisSchemaDate) {
				winston.info('[2014/6/17] Upgrading category post counts...');

				db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
					if (err) {
						return next(err);
					}

					async.each(cids, function(cid, next) {
						db.setObjectField('category:' + cid, 'post_count', 0, next);
					}, function(err) {
						if (err) {
							return next(err);
						}
						db.getSortedSetRange('topics:tid', 0, -1, function(err, tids) {
							function upgradeTopic(tid, callback) {

								Topics.getTopicFields(tid, ['cid', 'postcount', 'deleted'], function(err, topicData) {
									if (err || !topicData) {
										return callback(err);
									}

									if (parseInt(topicData.deleted, 10) === 1) {
										return callback();
									}

									db.incrObjectFieldBy('category:' + topicData.cid, 'post_count', topicData.postcount, callback);
								});
							}

							if (err) {
								return next(err);
							}

							if (!Array.isArray(tids) || !tids.length)  {
								winston.info('[2014/6/17] Skipping category post upgrade');
								return Upgrade.update(thisSchemaDate, next);
							}

							async.eachLimit(tids, 10, upgradeTopic, function(err) {
								if (err) {
									winston.error('[2014/6/17] Error encountered while upgrading category postcounts');
									return next(err);
								}
								winston.info('[2014/6/17] Category post counts upgraded');
								Upgrade.update(thisSchemaDate, next);
							});
						});
					});
				});
			} else {
				winston.info('[2014/6/17] Category post count upgrade - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 6, 23);

			if (schemaDate < thisSchemaDate) {
				winston.info('[2014/7/23] Upgrading db dependencies...');
				var install = require('./install');
				var config = require('../config.json');
				install.installDbDependencies(config, function(err) {
					if (err) {
						winston.error('[2014/7/23] Error encountered while upgrading db dependencies');
						return next(err);
					}

					winston.info('[2014/7/23] Upgraded db dependencies');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2014/7/23] Upgrading db dependencies - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 6, 24);

			if (schemaDate < thisSchemaDate) {
				winston.info('[2014/7/24] Upgrading chats to sorted set...');

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					if (err) {
						return next(err);
					}

					async.eachLimit(uids, 10, function(uid, next) {
						db.getSortedSetRange('uid:' + uid + ':chats', 0, -1, function(err, toUids) {
							if (err) {
								return next(err);
							}

							if (!Array.isArray(toUids) || !toUids.length) {
								return next();
							}

							async.eachLimit(toUids, 10, function(toUid, next) {
								var uids = [uid, toUid].sort();
								db.getListRange('messages:' + uids[0] + ':' + uids[1], 0, -1, function(err, mids) {
									if (err) {
										return next(err);
									}

									if (!Array.isArray(mids) || !mids.length) {
										return next();
									}

									async.eachLimit(mids, 10, function(mid, next) {
										db.getObjectField('message:' + mid, 'timestamp', function(err, timestamp) {
											if (err || !timestamp) {
												return next(err);
											}

											db.sortedSetAdd('messages:uid:' + uids[0] + ':to:' + uids[1], timestamp, mid, next);
										});
									}, next);
								});
							}, next);
						});
					}, function(err) {
						if (err) {
							winston.error('[2014/7/24] Error encountered while updating chats to sorted set');
							return next(err);
						}

						async.eachLimit(uids, 10, function(uid, next) {
							db.getSortedSetRange('uid:' + uid + ':chats', 0, -1, function(err, toUids) {
								if (err) {
									return next(err);
								}

								if (!Array.isArray(toUids) || !toUids.length) {
									return next();
								}

								async.eachLimit(toUids, 10, function(toUid, next) {
									var uids = [uid, toUid].sort();
									db.delete('messages:' + uids[0] + ':' + uids[1], next);
								}, next);
							});
						}, function(err) {
							if (err) {
								winston.error('[2014/7/24] Error encountered while updating chats to sorted set');
								return next(err);
							}

							winston.info('[2014/7/24] Upgraded chats to sorted set');
							Upgrade.update(thisSchemaDate, next);
						});
					});
				});
			} else {
				winston.info('[2014/7/24] Upgrading chats to sorted set - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 8, 8);

			if (schemaDate < thisSchemaDate) {
				winston.info('[2014/9/8] Deleting old notifications...');

				async.parallel({
					uids: function(next) {
						db.getSortedSetRange('users:joindate', 0, -1, next);
					},
					nids: function(next) {
						db.getSetMembers('notifications', next);
					}
				}, function(err, results) {
					if (err) {
						return next(err);
					}
					var uidKeys = results.uids.map(function(uid) {
						return 'uid:' + uid + ':notifications:uniqueId:nid';
					});

					var nidKeys = results.nids.filter(Boolean).map(function(nid) {
						return 'notifications:' + nid;
					});

					async.series([
						function(next) {
							db.deleteAll(nidKeys, next);
						},
						function(next) {
							db.deleteAll(uidKeys, next);
						},
						function(next) {
							db.delete('notifications', next);
						}
					], function(err, results) {
						if (err) {
							winston.error('[2014/9/8] Error encountered while deleting notifications');
							return next(err);
						}

						winston.info('[2014/9/8] Deleted old notifications');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2014/9/8] Deleting old notifications skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2014, 8, 27);
			if (schemaDate < thisSchemaDate) {
				winston.info('[2014/9/27] Deleting tid:<tid>:read_by_uid...');

				db.getSortedSetRange('topics:tid', 0, -1, function(err, tids) {
					if (err) {
						return next(err);
					}
					tids = tids.filter(Boolean);
					var readKeys = tids.map(function(tid) {
						return 'tid:' + tid + ':read_by_uid';
					});

					db.deleteAll(readKeys, function(err, results) {
						if (err) {
							winston.error('[2014/9/27] Error encountered while deleting tid:<tid>:read_by_uid');
							return next(err);
						}

						winston.info('[2014/9/27] Deleted tid:<tid>:read_by_uid');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2014/9/27] Deleting tid:<tid>:read_by_uid skipped');
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
