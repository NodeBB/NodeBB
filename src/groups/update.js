'use strict';

var async = require('async');
var winston = require('winston');

var plugins = require('../plugins');
var utils = require('../../public/src/utils');
var db = require('../database');


module.exports = function(Groups) {

	Groups.update = function(groupName, values, callback) {
		callback = callback || function() {};
		db.exists('group:' + groupName, function (err, exists) {
			if (err || !exists) {
				return callback(err || new Error('[[error:no-group]]'));
			}

			plugins.fireHook('filter:group.update', {
				groupName: groupName,
				values: values
			}, function(err) {
				if (err) {
					return callback(err);
				}

				var payload = {
					description: values.description || '',
					icon: values.icon || '',
					labelColor: values.labelColor || '#000000'
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
					async.apply(updatePrivacy, groupName, values.private),
					function(next) {
						if (values.hasOwnProperty('hidden')) {
							updateVisibility(groupName, values.hidden, next);
						} else {
							next();
						}
					},
					async.apply(db.setObject, 'group:' + groupName, payload),
					async.apply(renameGroup, groupName, values.name)
				], function(err) {
					if (err) {
						return callback(err);
					}
	
					plugins.fireHook('action:group.update', {
						name: groupName,
						values: values
					});
					callback();
				});
			});
		});
	};

	function updateVisibility(groupName, hidden, callback) {
		if (hidden) {
			async.parallel([
				async.apply(db.sortedSetRemove, 'groups:visible:createtime', groupName),
				async.apply(db.sortedSetRemove, 'groups:visible:memberCount', groupName),
				async.apply(db.sortedSetRemove, 'groups:visible:name', groupName.toLowerCase() + ':' + groupName),
			], callback);
		} else {
			db.getObjectFields('group:' + groupName, ['createtime', 'memberCount'], function(err, groupData) {
				if (err) {
					return callback(err);
				}
				async.parallel([
					async.apply(db.sortedSetAdd, 'groups:visible:createtime', groupData.createtime, groupName),
					async.apply(db.sortedSetAdd, 'groups:visible:memberCount', groupData.memberCount, groupName),
					async.apply(db.sortedSetAdd, 'groups:visible:name', 0, groupName.toLowerCase() + ':' + groupName),
				], callback);
			});
		}
	}

	Groups.hide = function(groupName, callback) {
		showHide(groupName, 'hidden', callback);
	};

	Groups.show = function(groupName, callback) {
		showHide(groupName, 'show', callback);
	};

	function showHide(groupName, hidden, callback) {
		hidden = hidden === 'hidden';
		callback = callback || function() {};
		async.parallel([
			async.apply(db.setObjectField, 'group:' + groupName, 'hidden', hidden ? 1 : 0),
			async.apply(updateVisibility, groupName, hidden)
		], function(err) {
			callback(err);
		});
	}

	function updatePrivacy(groupName, newValue, callback) {
		if (!newValue) {
			return callback();
		}

		Groups.getGroupFields(groupName, ['private'], function(err, currentValue) {
			if (err) {
				return callback(err);
			}
			currentValue = currentValue.private === '1';

			if (currentValue !== newValue && currentValue === true) {
				// Group is now public, so all pending users are automatically considered members
				db.getSetMembers('group:' + groupName + ':pending', function(err, uids) {
					if (err) { return callback(err); }
					else if (!uids) { return callback(); }	// No pending users, we're good to go

					var now = Date.now(),
						scores = uids.map(function() { return now; });	// There's probably a better way to initialise an Array of size x with the same value...

					winston.verbose('[groups.update] Group is now public, automatically adding ' + uids.length + ' new members, who were pending prior.');
					async.series([
						async.apply(db.sortedSetAdd, 'group:' + groupName + ':members', scores, uids),
						async.apply(db.delete, 'group:' + groupName + ':pending')
					], callback);
				});
			} else {
				callback();
			}
		});
	}

	function checkNameChange(currentName, newName, callback) {
		if (currentName === newName) {
			return callback();
		}
		var currentSlug = utils.slugify(currentName);
		var newSlug = utils.slugify(newName);
		if (currentSlug === newSlug) {
			return callback();
		}
		Groups.existsBySlug(newSlug, function(err, exists) {
			if (err || exists) {
				return callback(err || new Error('[[error:group-already-exists]]'));
			}
			callback();
		});
	}

	function renameGroup(oldName, newName, callback) {
		if (oldName === newName || !newName || newName.length === 0) {
			return callback();
		}

		db.getObject('group:' + oldName, function(err, group) {
			if (err || !group) {
				return callback(err);
			}

			if (parseInt(group.system, 10) === 1) {
				return callback();
			}

			Groups.exists(newName, function(err, exists) {
				if (err || exists) {
					return callback(err || new Error('[[error:group-already-exists]]'));
				}

				async.series([
					async.apply(db.setObjectField, 'group:' + oldName, 'name', newName),
					async.apply(db.setObjectField, 'group:' + oldName, 'slug', utils.slugify(newName)),
					async.apply(db.deleteObjectField, 'groupslug:groupname', group.slug),
					async.apply(db.setObjectField, 'groupslug:groupname', utils.slugify(newName), newName),
					function(next) {
						db.getSortedSetRange('groups:createtime', 0, -1, function(err, groups) {
							if (err) {
								return next(err);
							}
							async.each(groups, function(group, next) {
								renameGroupMember('group:' + group + ':members', oldName, newName, next);
							}, next);
						});
					},
					async.apply(db.rename, 'group:' + oldName, 'group:' + newName),
					async.apply(db.rename, 'group:' + oldName + ':members', 'group:' + newName + ':members'),
					async.apply(db.rename, 'group:' + oldName + ':owners', 'group:' + newName + ':owners'),
					async.apply(db.rename, 'group:' + oldName + ':pending', 'group:' + newName + ':pending'),
					async.apply(db.rename, 'group:' + oldName + ':invited', 'group:' + newName + ':invited'),

					async.apply(renameGroupMember, 'groups:createtime', oldName, newName),
					async.apply(renameGroupMember, 'groups:visible:createtime', oldName, newName),
					async.apply(renameGroupMember, 'groups:visible:memberCount', oldName, newName),
					async.apply(renameGroupMember, 'groups:visible:name', oldName.toLowerCase() + ':' + oldName, newName.toLowerCase() + ':' + newName),
					function(next) {
						plugins.fireHook('action:group.rename', {
							old: oldName,
							new: newName
						});

						next();
					}
				], callback);
			});
		});
	}

	function renameGroupMember(group, oldName, newName, callback) {
		db.isSortedSetMember(group, oldName, function(err, isMember) {
			if (err || !isMember) {
				return callback(err);
			}
			var score;
			async.waterfall([
				function (next) {
					db.sortedSetScore(group, oldName, next);
				},
				function (_score, next) {
					score = _score;
					db.sortedSetRemove(group, oldName, next);
				},
				function (next) {
					db.sortedSetAdd(group, score, newName, next);
				}
			], callback);
		});
	}
};
