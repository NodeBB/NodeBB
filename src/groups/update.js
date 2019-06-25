'use strict';

var async = require('async');
var winston = require('winston');

var plugins = require('../plugins');
var utils = require('../utils');
var db = require('../database');
var user = require('../user');


module.exports = function (Groups) {
	Groups.update = function (groupName, values, callback) {
		callback = callback || function () {};

		async.waterfall([
			function (next) {
				db.exists('group:' + groupName, next);
			},
			function (exists, next) {
				if (!exists) {
					return next(new Error('[[error:no-group]]'));
				}
				plugins.fireHook('filter:group.update', {
					groupName: groupName,
					values: values,
				}, next);
			},
			function (result, next) {
				values = result.values;

				var payload = {
					description: values.description || '',
					icon: values.icon || '',
					labelColor: values.labelColor || '#000000',
					textColor: values.textColor || '#ffffff',
				};

				if (values.hasOwnProperty('userTitle')) {
					payload.userTitle = values.userTitle || '';
				}

				if (values.hasOwnProperty('userTitleEnabled')) {
					payload.userTitleEnabled = values.userTitleEnabled ? '1' : '0';
				}

				if (values.hasOwnProperty('hidden')) {
					payload.hidden = values.hidden ? '1' : '0';
				}

				if (values.hasOwnProperty('private')) {
					payload.private = values.private ? '1' : '0';
				}

				if (values.hasOwnProperty('disableJoinRequests')) {
					payload.disableJoinRequests = values.disableJoinRequests ? '1' : '0';
				}
				async.series([
					async.apply(checkNameChange, groupName, values.name),
					function (next) {
						if (values.hasOwnProperty('private')) {
							updatePrivacy(groupName, values.private, next);
						} else {
							next();
						}
					},
					function (next) {
						if (values.hasOwnProperty('hidden')) {
							updateVisibility(groupName, values.hidden, next);
						} else {
							next();
						}
					},
					async.apply(db.setObject, 'group:' + groupName, payload),
					async.apply(Groups.renameGroup, groupName, values.name),
				], next);
			},
			function (result, next) {
				plugins.fireHook('action:group.update', {
					name: groupName,
					values: values,
				});
				next();
			},
		], callback);
	};

	function updateVisibility(groupName, hidden, callback) {
		if (hidden) {
			async.parallel([
				async.apply(db.sortedSetsRemove, ['groups:visible:createtime', 'groups:visible:memberCount'], groupName),
				async.apply(db.sortedSetRemove, 'groups:visible:name', groupName.toLowerCase() + ':' + groupName),
			], callback);
		} else {
			async.waterfall([
				function (next) {
					db.getObjectFields('group:' + groupName, ['createtime', 'memberCount'], next);
				},
				function (groupData, next) {
					db.sortedSetAddBulk([
						['groups:visible:createtime', groupData.createtime, groupName],
						['groups:visible:memberCount', groupData.memberCount, groupName],
						['groups:visible:name', 0, groupName.toLowerCase() + ':' + groupName],
					], next);
				},
			], callback);
		}
	}

	Groups.hide = function (groupName, callback) {
		showHide(groupName, 'hidden', callback);
	};

	Groups.show = function (groupName, callback) {
		showHide(groupName, 'show', callback);
	};

	function showHide(groupName, hidden, callback) {
		hidden = hidden === 'hidden';
		callback = callback || function () {};
		async.parallel([
			async.apply(db.setObjectField, 'group:' + groupName, 'hidden', hidden ? 1 : 0),
			async.apply(updateVisibility, groupName, hidden),
		], function (err) {
			callback(err);
		});
	}

	function updatePrivacy(groupName, isPrivate, callback) {
		async.waterfall([
			function (next) {
				Groups.getGroupFields(groupName, ['private'], next);
			},
			function (currentValue, next) {
				var currentlyPrivate = currentValue.private === 1;
				if (!currentlyPrivate || currentlyPrivate === isPrivate) {
					return callback();
				}
				db.getSetMembers('group:' + groupName + ':pending', next);
			},
			function (uids, next) {
				if (!uids.length) {
					return callback();
				}
				var now = Date.now();
				winston.verbose('[groups.update] Group is now public, automatically adding ' + uids.length + ' new members, who were pending prior.');
				async.series([
					async.apply(db.sortedSetAdd, 'group:' + groupName + ':members', uids.map(() => now), uids),
					async.apply(db.delete, 'group:' + groupName + ':pending'),
				], next);
			},
		], function (err) {
			callback(err);
		});
	}

	function checkNameChange(currentName, newName, callback) {
		if (currentName === newName) {
			return setImmediate(callback);
		}
		var currentSlug = utils.slugify(currentName);
		var newSlug = utils.slugify(newName);
		if (currentSlug === newSlug) {
			return setImmediate(callback);
		}
		async.waterfall([
			function (next) {
				async.parallel({
					group: function (next) {
						Groups.getGroupData(currentName, next);
					},
					exists: function (next) {
						Groups.existsBySlug(newSlug, next);
					},
				}, next);
			},
			function (results, next) {
				if (results.exists) {
					return next(new Error('[[error:group-already-exists]]'));
				}

				if (!results.group) {
					return next(new Error('[[error:no-group]]'));
				}

				if (results.group.system) {
					return next(new Error('[[error:not-allowed-to-rename-system-group]]'));
				}

				next();
			},
		], callback);
	}

	Groups.renameGroup = function (oldName, newName, callback) {
		if (oldName === newName || !newName || newName.length === 0) {
			return setImmediate(callback);
		}
		var group;
		async.waterfall([
			function (next) {
				db.getObject('group:' + oldName, next);
			},
			function (_group, next) {
				group = _group;
				if (!group) {
					return callback();
				}

				Groups.exists(newName, next);
			},
			function (exists, next) {
				if (exists) {
					return callback(new Error('[[error:group-already-exists]]'));
				}
				async.series([
					async.apply(updateMemberGroupTitles, oldName, newName),
					async.apply(updateNavigationItems, oldName, newName),
					async.apply(updateWidgets, oldName, newName),
					async.apply(db.setObjectField, 'group:' + oldName, 'name', newName),
					async.apply(db.setObjectField, 'group:' + oldName, 'slug', utils.slugify(newName)),
					async.apply(db.deleteObjectField, 'groupslug:groupname', group.slug),
					async.apply(db.setObjectField, 'groupslug:groupname', utils.slugify(newName), newName),
					function (next) {
						db.getSortedSetRange('groups:createtime', 0, -1, function (err, groups) {
							if (err) {
								return next(err);
							}
							const keys = groups.map(group => 'group:' + group + ':members');
							renameGroupsMember(keys, oldName, newName, next);
						});
					},
					async.apply(db.rename, 'group:' + oldName, 'group:' + newName),
					async.apply(db.rename, 'group:' + oldName + ':members', 'group:' + newName + ':members'),
					async.apply(db.rename, 'group:' + oldName + ':owners', 'group:' + newName + ':owners'),
					async.apply(db.rename, 'group:' + oldName + ':pending', 'group:' + newName + ':pending'),
					async.apply(db.rename, 'group:' + oldName + ':invited', 'group:' + newName + ':invited'),
					async.apply(db.rename, 'group:' + oldName + ':member:pids', 'group:' + newName + ':member:pids'),

					async.apply(renameGroupsMember, ['groups:createtime', 'groups:visible:createtime', 'groups:visible:memberCount'], oldName, newName),
					async.apply(renameGroupsMember, ['groups:visible:name'], oldName.toLowerCase() + ':' + oldName, newName.toLowerCase() + ':' + newName),
					function (next) {
						plugins.fireHook('action:group.rename', {
							old: oldName,
							new: newName,
						});
						Groups.resetCache();
						next();
					},
				], next);
			},
		], function (err) {
			callback(err);
		});
	};

	function updateMemberGroupTitles(oldName, newName, callback) {
		const batch = require('../batch');
		batch.processSortedSet('group:' + oldName + ':members', function (uids, next) {
			async.waterfall([
				function (next) {
					user.getUsersData(uids, next);
				},
				function (usersData, next) {
					usersData = usersData.filter(userData => userData && userData.groupTitleArray.includes(oldName));
					async.each(usersData, function (userData, next) {
						const newTitleArray = userData.groupTitleArray.map(oldTitle => (oldTitle === oldName ? newName : oldTitle));
						user.setUserField(userData.uid, 'groupTitle', JSON.stringify(newTitleArray), next);
					}, next);
				},
			], next);
		}, callback);
	}

	function renameGroupsMember(keys, oldName, newName, callback) {
		var scores;
		async.waterfall([
			function (next) {
				db.isMemberOfSortedSets(keys, oldName, next);
			},
			function (isMembers, next) {
				keys = keys.filter((key, index) => isMembers[index]);
				if (!keys.length) {
					return callback();
				}
				db.sortedSetsScore(keys, oldName, next);
			},
			function (_scores, next) {
				scores = _scores;
				db.sortedSetsRemove(keys, oldName, next);
			},
			function (next) {
				db.sortedSetsAdd(keys, scores, newName, next);
			},
		], callback);
	}

	function updateNavigationItems(oldName, newName, callback) {
		const navigation = require('../navigation/admin');

		async.waterfall([
			navigation.get,
			function (navItems, next) {
				navItems.forEach(function (navItem) {
					if (navItem && Array.isArray(navItem.groups) && navItem.groups.includes(oldName)) {
						navItem.groups.splice(navItem.groups.indexOf(oldName), 1, newName);
					}
				});

				navigation.save(navItems, next);
			},
		], callback);
	}

	function updateWidgets(oldName, newName, callback) {
		const admin = require('../widgets/admin');
		const widgets = require('../widgets');
		async.waterfall([
			admin.get,
			function (data, next) {
				async.eachSeries(data.areas, function (area, next) {
					if (!area.data.length) {
						return setImmediate(next);
					}
					area.widgets = area.data;
					area.widgets.forEach(function (widget) {
						if (widget && widget.data && Array.isArray(widget.data.groups) && widget.data.groups.includes(oldName)) {
							widget.data.groups.splice(widget.data.groups.indexOf(oldName), 1, newName);
						}
					});

					widgets.setArea(area, next);
				}, next);
			},
		], callback);
	}
};
