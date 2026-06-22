'use strict';

const nconf = require('nconf');

const db = require('../database');
const plugins = require('../plugins');
const utils = require('../utils');
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

		await modifyGroups(groupData, fields);

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

	async function modifyGroups(groups, fields) {
		await Promise.all(groups.map(async (group) => {
			if (group) {
				const hasField = utils.createFieldChecker(fields);

				if (hasField('private')) {
					// Default to private if not set, as groups are private by default
					group.private = ([null, undefined].includes(group.private)) ? 1 : group.private;
				}

				db.parseIntFields(group, intFields, fields);

				if (hasField('name')) {
					group.nameEncoded = encodeURIComponent(group.name);
					group.displayName = String(group.name);
				}

				if (hasField('description')) {
					group.description = String(group.description || '');
					if (hasField('descriptionParsed')) {
						group.descriptionParsed = await plugins.hooks.fire('filter:parse.raw', group.description);
					}
				}

				if (hasField('userTitle')) {
					group.userTitle = String(group.userTitle || '');
				}

				if (hasField('slug') && group.name && !group.slug) {
					group.slug = slugify(group.name);
				}

				if (hasField('labelColor')) {
					group.labelColor = String(group.labelColor || '#000000');
				}

				if (hasField('textColor')) {
					group.textColor = String(group.textColor || '#ffffff');
				}

				if (hasField('icon')) {
					group.icon = String(group.icon || '');
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
					group['cover:position'] = String(group['cover:position'] || '50% 50%');
				}
			}
		}));
	}
};
