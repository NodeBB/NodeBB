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

	minSchemaDate = Date.UTC(2015, 0, 30),		// This value gets updated every new MINOR version
	schemaDate, thisSchemaDate,

	// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema
	latestSchema = Date.UTC(2015, 8, 30);

Upgrade.check = function(callback) {
	db.get('schemaDate', function(err, value) {
		if (err) {
			return callback(err);
		}

		if (!value) {
			db.set('schemaDate', latestSchema, function(err) {
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
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 1, 17);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/02/17] renaming home.tpl to categories.tpl');

				db.rename('widgets:home.tpl', 'widgets:categories.tpl', function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2015/02/17] renaming home.tpl to categories.tpl done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2015/02/17] renaming home.tpl to categories.tpl skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 1, 23);
			if (schemaDate < thisSchemaDate) {
				db.setAdd('plugins:active', 'nodebb-rewards-essentials', function(err) {
					winston.info('[2015/2/23] Activating NodeBB Essential Rewards');
					Plugins.reload(function() {
						if (err) {
							next(err);
						} else {
							Upgrade.update(thisSchemaDate, next);
						}
					});
				});
			} else {
				winston.info('[2015/2/23] Activating NodeBB Essential Rewards - skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 1, 24);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/02/24] Upgrading plugins:active to sorted set');

				db.getSetMembers('plugins:active', function(err, activePlugins) {
					if (err) {
						return next(err);
					}
					if (!Array.isArray(activePlugins) || !activePlugins.length) {
						winston.info('[2015/02/24] Upgrading plugins:active to sorted set done');
						Upgrade.update(thisSchemaDate, next);
					}

					db.delete('plugins:active', function(err) {
						if (err) {
							return next(err);
						}
						var order = -1;
						async.eachSeries(activePlugins, function(plugin, next) {
							++order;
							db.sortedSetAdd('plugins:active', order, plugin, next);
						}, function(err) {
							if (err) {
								return next(err);
							}
							winston.info('[2015/02/24] Upgrading plugins:active to sorted set done');
							Upgrade.update(thisSchemaDate, next);
						});
					});
				});
			} else {
				winston.info('[2015/02/24] Upgrading plugins:active to sorted set skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 1, 24, 1);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/02/24] Upgrading privilege groups to system groups');

				var isPrivilegeGroup = /^cid:\d+:privileges:[\w:]+$/;
				db.getSortedSetRange('groups:createtime', 0, -1, function (err, groupNames) {
					groupNames = groupNames.filter(function(name) {
						return isPrivilegeGroup.test(name);
					});

					async.eachLimit(groupNames, 5, function(groupName, next) {
						db.setObjectField('group:' + groupName, 'system', '1', next);
					}, function(err) {
						if (err) {
							return next(err);
						}
						winston.info('[2015/02/24] Upgrading privilege groups to system groups done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/02/24] Upgrading privilege groups to system groups skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 1, 25, 6);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/02/25] Upgrading menu items to dynamic navigation system');

				require('./navigation/admin').save(require('../install/data/navigation.json'), function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2015/02/25] Upgrading menu items to dynamic navigation system done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2015/02/25] Upgrading menu items to dynamic navigation system skipped');
				next();
			}
		},
		function(next) {
			function upgradeHashToSortedSet(hash, callback) {
				db.getObject(hash, function(err, oldHash) {
					if (err || !oldHash) {
						return callback(err);
					}

					db.rename(hash, hash + '_old', function(err) {
						if (err) {
							return callback(err);
						}
						var keys = Object.keys(oldHash);
						if (!keys.length) {
							return callback();
						}
						async.each(keys, function(key, next) {
							db.sortedSetAdd(hash, oldHash[key], key, next);
						}, callback);
					});
				});
			}

			thisSchemaDate = Date.UTC(2015, 4, 7);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/05/07] Upgrading uid mappings to sorted set');

				async.series([
					async.apply(upgradeHashToSortedSet, 'email:uid'),
					async.apply(upgradeHashToSortedSet, 'fullname:uid'),
					async.apply(upgradeHashToSortedSet, 'username:uid'),
					async.apply(upgradeHashToSortedSet, 'userslug:uid'),
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2015/05/07] Upgrading uid mappings to sorted set done');
					Upgrade.update(thisSchemaDate, next);
				});

			} else {
				winston.info('[2015/05/07] Upgrading uid mappings to sorted set skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 4, 8);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/05/08] Fixing emails');

				db.getSortedSetRangeWithScores('email:uid', 0, -1, function(err, users) {
					if (err) {
						return next(err);
					}

					async.eachLimit(users, 100, function(user, next) {
						var newEmail = user.value.replace(/\uff0E/g, '.');
						if (newEmail === user.value) {
							return process.nextTick(next);
						}
						async.series([
							async.apply(db.sortedSetRemove, 'email:uid', user.value),
							async.apply(db.sortedSetAdd, 'email:uid', user.score, newEmail)
						], next);

					}, function(err) {
						if (err) {
							return next(err);
						}
						winston.info('[2015/05/08] Fixing emails done');
						Upgrade.update(thisSchemaDate, next);
					});
				});

			} else {
				winston.info('[2015/05/08] Fixing emails skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 4, 11);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/05/11] Updating widgets to tjs 0.2x');

				require('./widgets/admin').get(function(err, data) {
					async.each(data.areas, function(area, next) {
						require('./widgets').getArea(area.template, area.location, function(err, widgets) {
							if (err) {
								return next(err);
							}

							for (var w in widgets) {
								if (widgets.hasOwnProperty(w)) {
									widgets[w].data.container = widgets[w].data.container
										.replace(/\{\{([\s\S]*?)\}\}/g, '{$1}')
										.replace(/\{([\s\S]*?)\}/g, '{{$1}}');
								}
							}

							require('./widgets').setArea({
								template: area.template,
								location: area.location,
								widgets: widgets
							}, next);
						});
					}, function(err) {
						if (err) {
							return next(err);
						}

						winston.info('[2015/05/11] Updating widgets to tjs 0.2x done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/05/11] Updating widgets to tjs 0.2x skipped');
				next();
			}
		},
		function(next) {
			function upgradeSet(set, callback) {
				db.getSortedSetRangeWithScores(set + ':uid', 0, -1, function(err, userData) {
					if (err) {
						return callback(err);
					}

					userData = userData.filter(function(user) {
						return user && user.value;
					});

					async.eachLimit(userData, 500, function(userData, next) {
						db.sortedSetAdd(set + ':sorted', 0, userData.value.toLowerCase() + ':' + userData.score, next);
					}, function(err) {
						callback(err);
					});
				});
			}

			thisSchemaDate = Date.UTC(2015, 4, 20);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/05/20] Adding username:sorted and email:sorted');

				async.series([
					function(next) {
						upgradeSet('username', next);
					},
					function(next) {
						upgradeSet('email', next);
					}
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2015/05/20] Added username:sorted and email:sorted');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2015/05/20] Adding username:sorted and email:sorted skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 5, 2);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/06/02] Creating group sorted sets');

				db.getSortedSetRange('groups:createtime', 0, -1, function(err, groupNames) {
					if (err) {
						return callback(err);
					}

					groupNames = groupNames.filter(Boolean);

					async.eachLimit(groupNames, 500, function(groupName, next) {
						db.getObjectFields('group:' + groupName, ['hidden', 'system', 'createtime', 'memberCount'], function(err, groupData) {
							if (err) {
								return next(err);
							}

							if (parseInt(groupData.hidden, 10) === 1 || parseInt(groupData.system, 10) === 1) {
								return next();
							}
							async.parallel([
								async.apply(db.sortedSetAdd, 'groups:visible:createtime', groupData.createtime, groupName),
								async.apply(db.sortedSetAdd, 'groups:visible:memberCount', groupData.memberCount || 0, groupName),
								async.apply(db.sortedSetAdd, 'groups:visible:name', 0, groupName.toLowerCase() + ':' + groupName)
							], next);
						});
					}, function(err) {
						if (err) {
							return next(err);
						}

						winston.info('[2015/06/02] Creating group sorted sets done');
						Upgrade.update(thisSchemaDate, next);
					});
				});
			} else {
				winston.info('[2015/06/02] Creating group sorted sets skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 6, 3);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/07/03] Enabling default composer plugin');

				db.isSortedSetMember('plugins:active', 'nodebb-plugin-composer-default', function(err, active) {
					if (!active) {
						Plugins.toggleActive('nodebb-plugin-composer-default', function(err) {
							if (err) {
								return next(err);
							}

							winston.info('[2015/07/03] Enabling default composer plugin done');
							Upgrade.update(thisSchemaDate, next);
						});
					} else {
						winston.info('[2015/07/03] Enabling default composer plugin done');
						Upgrade.update(thisSchemaDate, next);
					}
				});
			} else {
				winston.info('[2015/07/03] Enabling default composer plugin skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 7, 18);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/08/18] Creating children category sorted sets');

				db.getSortedSetRange('categories:cid', 0, -1, function(err, cids) {
					if (err) {
						return next(err);
					}

					async.each(cids, function(cid, next) {
						db.getObjectFields('category:' + cid, ['parentCid', 'order'], function(err, category) {
							if (err) {
								return next(err);
							}
							if (!category) {
								return next();
							}
							if (parseInt(category.parentCid, 10)) {
								db.sortedSetAdd('cid:' + category.parentCid + ':children', parseInt(category.order, 10), cid, next);
							} else {
								db.sortedSetAdd('cid:0:children', parseInt(category.order, 10), cid, next);
							}
						});
					}, function(err) {
						if (err) {
							return next(err);
						}

						winston.info('[2015/08/18] Creating children category sorted sets done');
						Upgrade.update(thisSchemaDate, next);
					});
				});

			} else {
				winston.info('[2015/08/18] Creating children category sorted sets skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 8, 27);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/09/27] Generating user icons');

				db.getSortedSetRange('users:joindate', 0, -1, function(err, uids) {
					async.eachLimit(uids, 20, User.icon.generate, function(err) {
						if (err) {
							return next(err);
						}

						winston.info('[2015/09/27] Generating user icons done');
						Upgrade.update(thisSchemaDate, next);
					})
				})
			} else {
				winston.info('[2015/09/27] Generating user icons skipped');
				next();
			}
		},
		function(next) {
			thisSchemaDate = Date.UTC(2015, 8, 30);
			if (schemaDate < thisSchemaDate) {
				updatesMade = true;
				winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar');

				async.waterfall([
					async.apply(db.isObjectField, 'config', 'customGravatarDefaultImage'),
					function(keyExists, _next) {
						if (keyExists) {
							_next();
						} else {
							winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar skipped');
							Upgrade.update(thisSchemaDate, next);
							next();
						}
					},
					async.apply(db.getObjectField, 'config', 'customGravatarDefaultImage'),
					async.apply(db.setObjectField, 'config', 'defaultAvatar'),
					async.apply(db.deleteObjectField, 'config', 'customGravatarDefaultImage')
				], function(err) {
					if (err) {
						return next(err);
					}

					winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar done');
					Upgrade.update(thisSchemaDate, next);
				});
			} else {
				winston.info('[2015/09/30] Converting default Gravatar image to default User Avatar skipped');
				next();
			}
		}


		// Add new schema updates here
		// IMPORTANT: REMEMBER TO UPDATE VALUE OF latestSchema IN LINE 24!!!
	], function(err) {
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
