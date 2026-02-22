'use strict';

const validator = require('validator');
const nconf = require('nconf');

const db = require('../database');
const plugins = require('../plugins');
const utils = require('../utils');
const translator = require('../translator');
const coverPhoto = require('../coverPhoto');
const slugify = require('../slugify');

const relative_path = nconf.get('relative_path');

const prependRelativePath = url => url.startsWith('http') ? url : relative_path + url;

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
		return groupData && groupData.hasOwnProperty(field) ? groupData[field] : null;
	};

	Groups.getGroupFields = async function (groupName, fields) {
		const groups = await Groups.getGroupsFields([groupName], fields);
		return groups ? groups[0] : null;
	};

	Groups.setGroupField = async function (groupName, field, value) {
		await db.setObjectField(`group:${groupName}`, field, value);
		plugins.hooks.fire('action:group.set', { field: field, value: value, type: 'set' });
	};

	function modifyGroup(group, fields) {
		if (group) {
			const hasField = utils.createFieldChecker(fields);

			if (hasField('private')) {
				// Default to private if not set, as groups are private by default
				group.private = ([null, undefined].includes(group.private)) ? 1 : group.private;
			}

			db.parseIntFields(group, intFields, fields);

			escapeGroupData(group, hasField);

			if (hasField('slug') && group.name && !group.slug) {
				group.slug = slugify(group.name);
			}

			if (hasField('labelColor')) {
				group.labelColor = validator.escape(String(group.labelColor || '#000000'));
			}

			if (hasField('textColor')) {
				group.textColor = validator.escape(String(group.textColor || '#ffffff'));
			}

			if (hasField('icon')) {
				group.icon = validator.escape(String(group.icon || ''));
			}

			if (hasField('createtime')) {
				group.createtimeISO = utils.toISOString(group.createtime);
			}

			if (hasField('memberPostCids')) {
				group.memberPostCids = group.memberPostCids || '';
				group.memberPostCidsArray = group.memberPostCids.split(',').map(cid => parseInt(cid, 10)).filter(Boolean);
			}

			if (hasField('cover:thumb:url')) {
				group['cover:thumb:url'] = group['cover:thumb:url'] || group['cover:url'];

				group['cover:thumb:url'] = group['cover:thumb:url'] ?
					prependRelativePath(group['cover:thumb:url']) :
					coverPhoto.getDefaultGroupCover(group.name);
			}

			if (hasField('cover:url')) {
				group['cover:url'] = group['cover:url'] ?
					prependRelativePath(group['cover:url']) :
					coverPhoto.getDefaultGroupCover(group.name);
			}

			if (hasField('cover:position')) {
				group['cover:position'] = validator.escape(String(group['cover:position'] || '50% 50%'));
			}
		}
	}

	function escapeGroupData(group, hasField) {
		if (group) {
			if (hasField('name')) {
				group.nameEncoded = encodeURIComponent(group.name);
				group.displayName = validator.escape(String(group.name));
				if (Groups.systemGroups.includes(group.name)) {
					group.displayName = group.displayName.replace(/-/g, ' ');
				}
			}
			if (hasField('description')) {
				group.description = validator.escape(String(group.description || ''));
			}
			if (hasField('userTitle')) {
				group.userTitle = validator.escape(String(group.userTitle || ''));
				group.userTitleEscaped = translator.escape(group.userTitle);
			}
		}
	}
};
