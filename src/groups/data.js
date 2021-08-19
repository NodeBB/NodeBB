'use strict';

const validator = require('validator');
const nconf = require('nconf');

const db = require('../database');
const plugins = require('../plugins');
const utils = require('../utils');
const translator = require('../translator');

const intFields = [
	'createtime', 'memberCount', 'hidden', 'system', 'private',
	'userTitleEnabled', 'disableJoinRequests', 'disableLeave',
];

module.exports = function (Groups) {
	Groups.getGroupsFields = async function (groupNames, fields) {
		if (!Array.isArray(groupNames) || !groupNames.length) {
			return [];
		}

		const ephemeralIdx = groupNames.reduce((memo, cur, idx) => {
			if (Groups.ephemeralGroups.includes(cur)) {
				memo.push(idx);
			}
			return memo;
		}, []);

		const keys = groupNames.map(groupName => `group:${groupName}`);
		const groupData = await db.getObjects(keys, fields);
		if (ephemeralIdx.length) {
			ephemeralIdx.forEach((idx) => {
				groupData[idx] = Groups.getEphemeralGroup(groupNames[idx]);
			});
		}

		groupData.forEach(group => modifyGroup(group, fields));

		const results = await plugins.hooks.fire('filter:groups.get', { groups: groupData });
		return results.groups;
	};

	Groups.getGroupsData = async function (groupNames) {
		return await Groups.getGroupsFields(groupNames, []);
	};

	Groups.getGroupData = async function (groupName) {
		const groupsData = await Groups.getGroupsData([groupName]);
		return Array.isArray(groupsData) && groupsData[0] ? groupsData[0] : null;
	};

	Groups.getGroupField = async function (groupName, field) {
		const groupData = await Groups.getGroupFields(groupName, [field]);
		return groupData ? groupData[field] : null;
	};

	Groups.getGroupFields = async function (groupName, fields) {
		const groups = await Groups.getGroupsFields([groupName], fields);
		return groups ? groups[0] : null;
	};

	Groups.setGroupField = async function (groupName, field, value) {
		await db.setObjectField(`group:${groupName}`, field, value);
		plugins.hooks.fire('action:group.set', { field: field, value: value, type: 'set' });
	};
};

function modifyGroup(group, fields) {
	if (group) {
		db.parseIntFields(group, intFields, fields);

		escapeGroupData(group);
		group.userTitleEnabled = ([null, undefined].includes(group.userTitleEnabled)) ? 1 : group.userTitleEnabled;
		group.labelColor = validator.escape(String(group.labelColor || '#000000'));
		group.textColor = validator.escape(String(group.textColor || '#ffffff'));
		group.icon = validator.escape(String(group.icon || ''));
		group.createtimeISO = utils.toISOString(group.createtime);
		group.private = ([null, undefined].includes(group.private)) ? 1 : group.private;
		group.memberPostCids = group.memberPostCids || '';
		group.memberPostCidsArray = group.memberPostCids.split(',').map(cid => parseInt(cid, 10)).filter(Boolean);

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
		group.userTitle = validator.escape(String(group.userTitle || ''));
		group.userTitleEscaped = translator.escape(group.userTitle);
	}
}
