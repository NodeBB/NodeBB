'use strict';

var async = require('async');
var validator = require('validator');
var nconf = require('nconf');

var db = require('../database');
var plugins = require('../plugins');
var utils = require('../utils');

const intFields = [
	'createtime', 'memberCount', 'hidden', 'system', 'private',
	'userTitleEnabled', 'disableJoinRequests',
];

module.exports = function (Groups) {
	Groups.getGroupsFields = function (groupNames, fields, callback) {
		if (!Array.isArray(groupNames) || !groupNames.length) {
			return callback(null, []);
		}

		var ephemeralIdx = groupNames.reduce(function (memo, cur, idx) {
			if (Groups.ephemeralGroups.includes(cur)) {
				memo.push(idx);
			}
			return memo;
		}, []);

		async.waterfall([
			function (next) {
				const keys = groupNames.map(groupName => 'group:' + groupName);
				if (fields.length) {
					db.getObjectsFields(keys, fields, next);
				} else {
					db.getObjects(keys, next);
				}
			},
			function (groupData, next) {
				if (ephemeralIdx.length) {
					ephemeralIdx.forEach(function (idx) {
						groupData[idx] = Groups.getEphemeralGroup(groupNames[idx]);
					});
				}

				groupData.forEach(group => modifyGroup(group, fields));

				plugins.fireHook('filter:groups.get', { groups: groupData }, next);
			},
			function (results, next) {
				next(null, results.groups);
			},
		], callback);
	};

	Groups.getGroupsData = function (groupNames, callback) {
		Groups.getGroupsFields(groupNames, [], callback);
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

function modifyGroup(group, fields) {
	if (group) {
		db.parseIntFields(group, intFields, fields);

		escapeGroupData(group);
		group.userTitleEnabled = ([null, undefined].includes(group.userTitleEnabled)) ? 1 : group.userTitleEnabled;
		group.labelColor = validator.escape(String(group.labelColor || '#000000'));
		group.icon = validator.escape(String(group.icon || ''));
		group.createtimeISO = utils.toISOString(group.createtime);
		group.private = ([null, undefined].includes(group.private)) ? 1 : group.private;

		group['cover:thumb:url'] = group['cover:thumb:url'] || group['cover:url'];

		if (group['cover:url']) {
			group['cover:url'] = group['cover:url'].startsWith('http') ? group['cover:url'] : (nconf.get('relative_path') + group['cover:url']);
		} else {
			group['cover:url'] = require('../coverPhoto').getDefaultGroupCover(group.name);
		}

		if (group['cover:thumb:url']) {
			group['cover:thumb:url'] = group['cover:thumb:url'].startsWith('http') ? group['cover:thumb:url'] : (nconf.get('relative_path') + group['cover:thumb:url']);
		} else {
			group['cover:thumb:url'] = require('../coverPhoto').getDefaultGroupCover(group.name);
		}

		group['cover:position'] = validator.escape(String(group['cover:position'] || '50% 50%'));
	}
}

function escapeGroupData(group) {
	if (group) {
		group.nameEncoded = encodeURIComponent(group.name);
		group.displayName = validator.escape(String(group.name));
		group.description = validator.escape(String(group.description || ''));
		group.userTitle = validator.escape(String(group.userTitle || '')) || group.displayName;
	}
}
