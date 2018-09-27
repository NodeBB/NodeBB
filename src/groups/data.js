'use strict';

var async = require('async');
var validator = require('validator');
var winston = require('winston');

var db = require('../database');
var plugins = require('../plugins');
var utils = require('../utils');

module.exports = function (Groups) {
	Groups.getGroupsData = function (groupNames, callback) {
		if (!Array.isArray(groupNames) || !groupNames.length) {
			return callback(null, []);
		}

		var keys = groupNames.map(function (groupName) {
			return 'group:' + groupName;
		});

		var ephemeralIdx = groupNames.reduce(function (memo, cur, idx) {
			if (Groups.ephemeralGroups.indexOf(cur) !== -1) {
				memo.push(idx);
			}
			return memo;
		}, []);

		async.waterfall([
			function (next) {
				db.getObjects(keys, next);
			},
			function (groupData, next) {
				if (ephemeralIdx.length) {
					ephemeralIdx.forEach(function (idx) {
						groupData[idx] = Groups.getEphemeralGroup(groupNames[idx]);
					});
				}

				groupData.forEach(function (group) {
					if (group) {
						Groups.escapeGroupData(group);
						group.userTitleEnabled = group.userTitleEnabled ? parseInt(group.userTitleEnabled, 10) === 1 : true;
						group.labelColor = validator.escape(String(group.labelColor || '#000000'));
						group.icon = validator.escape(String(group.icon || ''));
						group.createtimeISO = utils.toISOString(group.createtime);
						group.hidden = parseInt(group.hidden, 10) === 1;
						group.system = parseInt(group.system, 10) === 1;
						group.private = (group.private === null || group.private === undefined) ? true : !!parseInt(group.private, 10);
						group.disableJoinRequests = parseInt(group.disableJoinRequests, 10) === 1;

						group['cover:url'] = group['cover:url'] || require('../coverPhoto').getDefaultGroupCover(group.name);
						group['cover:thumb:url'] = group['cover:thumb:url'] || group['cover:url'];
						group['cover:position'] = validator.escape(String(group['cover:position'] || '50% 50%'));
					}
				});

				plugins.fireHook('filter:groups.get', { groups: groupData }, next);
			},
			function (results, next) {
				next(null, results.groups);
			},
		], callback);
	};

	Groups.getGroupData = function (groupName, callback) {
		Groups.getGroupsData([groupName], function (err, groupsData) {
			callback(err, Array.isArray(groupsData) && groupsData[0] ? groupsData[0] : null);
		});
	};

	Groups.getGroupFields = function (groupName, fields, callback) {
		Groups.getGroupsFields([groupName], fields, function (err, groups) {
			callback(err, groups ? groups[0] : null);
		});
	};

	Groups.getGroupsFields = function (groupNames, fields, callback) {
		db.getObjectsFields(groupNames.map(function (group) {
			return 'group:' + group;
		}), fields, callback);
	};

	Groups.getMultipleGroupFields = function (groups, fields, callback) {
		winston.warn('[deprecated] Groups.getMultipleGroupFields is deprecated please use Groups.getGroupsFields');
		Groups.getGroupsFields(groups, fields, callback);
	};

	Groups.setGroupField = function (groupName, field, value, callback) {
		async.waterfall([
			function (next) {
				db.setObjectField('group:' + groupName, field, value, next);
			},
			function (next) {
				plugins.fireHook('action:group.set', { field: field, value: value, type: 'set' });
				next();
			},
		], callback);
	};
};
