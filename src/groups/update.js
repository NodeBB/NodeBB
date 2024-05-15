'use strict';

const winston = require('winston');

const categories = require('../categories');
const plugins = require('../plugins');
const slugify = require('../slugify');
const db = require('../database');
const user = require('../user');
const batch = require('../batch');
const meta = require('../meta');
const cache = require('../cache');


module.exports = function (Groups) {
	Groups.update = async function (groupName, values) {
		const exists = await db.exists(`group:${groupName}`);
		if (!exists) {
			throw new Error('[[error:no-group]]');
		}

		({ values } = await plugins.hooks.fire('filter:group.update', {
			groupName: groupName,
			values: values,
		}));

		// Cast some values as bool (if not boolean already)
		// 'true' and '1' = true, everything else false
		['userTitleEnabled', 'private', 'hidden', 'disableJoinRequests', 'disableLeave'].forEach((prop) => {
			if (values.hasOwnProperty(prop) && typeof values[prop] !== 'boolean') {
				values[prop] = values[prop] === 'true' || parseInt(values[prop], 10) === 1;
			}
		});

		const payload = {
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

		if (values.hasOwnProperty('disableLeave')) {
			payload.disableLeave = values.disableLeave ? '1' : '0';
		}

		if (values.hasOwnProperty('name')) {
			await checkNameChange(groupName, values.name);
		}

		if (values.hasOwnProperty('private')) {
			await updatePrivacy(groupName, values.private);
		}

		if (values.hasOwnProperty('hidden')) {
			await updateVisibility(groupName, values.hidden);
		}

		if (values.hasOwnProperty('memberPostCids')) {
			const validCids = await categories.getCidsByPrivilege('categories:cid', groupName, 'topics:read');
			const cidsArray = values.memberPostCids.split(',').map(cid => parseInt(cid.trim(), 10)).filter(Boolean);
			payload.memberPostCids = cidsArray.filter(cid => validCids.includes(cid)).join(',') || '';
		}

		await db.setObject(`group:${groupName}`, payload);
		await Groups.renameGroup(groupName, values.name);

		plugins.hooks.fire('action:group.update', {
			name: groupName,
			values: values,
		});
	};

	async function updateVisibility(groupName, hidden) {
		if (hidden) {
			await db.sortedSetRemoveBulk([
				['groups:visible:createtime', groupName],
				['groups:visible:memberCount', groupName],
				['groups:visible:name', `${groupName.toLowerCase()}:${groupName}`],
			]);
			return;
		}
		const groupData = await db.getObjectFields(`group:${groupName}`, ['createtime', 'memberCount']);
		await db.sortedSetAddBulk([
			['groups:visible:createtime', groupData.createtime, groupName],
			['groups:visible:memberCount', groupData.memberCount, groupName],
			['groups:visible:name', 0, `${groupName.toLowerCase()}:${groupName}`],
		]);
	}

	Groups.hide = async function (groupName) {
		await showHide(groupName, 'hidden');
	};

	Groups.show = async function (groupName) {
		await showHide(groupName, 'show');
	};

	async function showHide(groupName, hidden) {
		hidden = hidden === 'hidden';
		await Promise.all([
			db.setObjectField(`group:${groupName}`, 'hidden', hidden ? 1 : 0),
			updateVisibility(groupName, hidden),
		]);
	}

	async function updatePrivacy(groupName, isPrivate) {
		const groupData = await Groups.getGroupFields(groupName, ['private']);
		const currentlyPrivate = groupData.private === 1;
		if (!currentlyPrivate || currentlyPrivate === isPrivate) {
			return;
		}
		const pendingUids = await db.getSetMembers(`group:${groupName}:pending`);
		if (!pendingUids.length) {
			return;
		}

		winston.verbose(`[groups.update] Group is now public, automatically adding ${pendingUids.length} new members, who were pending prior.`);

		for (const uid of pendingUids) {
			/* eslint-disable no-await-in-loop */
			await Groups.join(groupName, uid);
		}
		await db.delete(`group:${groupName}:pending`);
	}

	async function checkNameChange(currentName, newName) {
		if (Groups.isPrivilegeGroup(newName)) {
			throw new Error('[[error:invalid-group-name]]');
		}
		const currentSlug = slugify(currentName);
		const newSlug = slugify(newName);
		if (currentName === newName || currentSlug === newSlug) {
			return;
		}
		Groups.validateGroupName(newName);
		const [group, exists] = await Promise.all([
			Groups.getGroupData(currentName),
			Groups.existsBySlug(newSlug),
		]);

		if (exists) {
			throw new Error('[[error:group-already-exists]]');
		}

		if (!group) {
			throw new Error('[[error:no-group]]');
		}

		if (group.system) {
			throw new Error('[[error:not-allowed-to-rename-system-group]]');
		}
	}

	Groups.renameGroup = async function (oldName, newName) {
		if (oldName === newName || !newName || String(newName).length === 0) {
			return;
		}
		const group = await db.getObject(`group:${oldName}`);
		if (!group) {
			return;
		}

		const exists = await Groups.exists(newName);
		if (exists) {
			throw new Error('[[error:group-already-exists]]');
		}

		await updateMemberGroupTitles(oldName, newName);
		await updateNavigationItems(oldName, newName);
		await updateWidgets(oldName, newName);
		await updateConfig(oldName, newName);
		await updateChatRooms(oldName, newName);
		await db.setObject(`group:${oldName}`, { name: newName, slug: slugify(newName) });
		if (!Groups.isPrivilegeGroup(oldName) && !Groups.isPrivilegeGroup(newName)) {
			await db.deleteObjectField('groupslug:groupname', group.slug);
			await db.setObjectField('groupslug:groupname', slugify(newName), newName);
		}

		const allGroups = await db.getSortedSetRange('groups:createtime', 0, -1);
		const keys = allGroups.map(group => `group:${group}:members`);
		await renameGroupsMember(keys, oldName, newName);
		cache.del(keys);

		await db.rename(`group:${oldName}`, `group:${newName}`);
		await db.rename(`group:${oldName}:members`, `group:${newName}:members`);
		await db.rename(`group:${oldName}:owners`, `group:${newName}:owners`);
		await db.rename(`group:${oldName}:pending`, `group:${newName}:pending`);
		await db.rename(`group:${oldName}:invited`, `group:${newName}:invited`);
		await db.rename(`group:${oldName}:member:pids`, `group:${newName}:member:pids`);

		await renameGroupsMember(['groups:createtime', 'groups:visible:createtime', 'groups:visible:memberCount'], oldName, newName);
		await renameGroupsMember(['groups:visible:name'], `${oldName.toLowerCase()}:${oldName}`, `${newName.toLowerCase()}:${newName}`);

		plugins.hooks.fire('action:group.rename', {
			old: oldName,
			new: newName,
		});
		Groups.cache.reset();
	};

	async function updateMemberGroupTitles(oldName, newName) {
		await batch.processSortedSet(`group:${oldName}:members`, async (uids) => {
			let usersData = await user.getUsersData(uids);
			usersData = usersData.filter(userData => userData && userData.groupTitleArray.includes(oldName));

			usersData.forEach((userData) => {
				userData.newTitleArray = userData.groupTitleArray.map(oldTitle => (oldTitle === oldName ? newName : oldTitle));
			});

			await Promise.all(usersData.map(u => user.setUserField(u.uid, 'groupTitle', JSON.stringify(u.newTitleArray))));
		}, {});
	}

	async function renameGroupsMember(keys, oldName, newName) {
		const isMembers = await db.isMemberOfSortedSets(keys, oldName);
		keys = keys.filter((key, index) => isMembers[index]);
		if (!keys.length) {
			return;
		}
		const scores = await db.sortedSetsScore(keys, oldName);
		await db.sortedSetsRemove(keys, oldName);
		await db.sortedSetsAdd(keys, scores, newName);
	}

	async function updateNavigationItems(oldName, newName) {
		const navigation = require('../navigation/admin');
		const navItems = await navigation.get();
		navItems.forEach((navItem) => {
			if (navItem && Array.isArray(navItem.groups) && navItem.groups.includes(oldName)) {
				navItem.groups.splice(navItem.groups.indexOf(oldName), 1, newName);
			}
		});
		navigation.unescapeFields(navItems);
		await navigation.save(navItems);
	}

	async function updateWidgets(oldName, newName) {
		const admin = require('../widgets/admin');
		const widgets = require('../widgets');

		const data = await admin.get();

		data.areas.forEach((area) => {
			area.widgets = area.data;
			area.widgets.forEach((widget) => {
				if (widget && widget.data && Array.isArray(widget.data.groups) && widget.data.groups.includes(oldName)) {
					widget.data.groups.splice(widget.data.groups.indexOf(oldName), 1, newName);
				}
			});
		});
		for (const area of data.areas) {
			if (area.data.length) {
				await widgets.setArea(area);
			}
		}
	}

	async function updateConfig(oldName, newName) {
		const configKeys = [
			'groupsExemptFromPostQueue',
			'groupsExemptFromNewUserRestrictions',
			'groupsExemptFromMaintenanceMode',
		];

		for (const key of configKeys) {
			if (meta.config[key] && meta.config[key].includes(oldName)) {
				meta.config[key].splice(
					meta.config[key].indexOf(oldName), 1, newName
				);
				await meta.configs.set(key, meta.config[key]);
			}
		}
	}

	async function updateChatRooms(oldName, newName) {
		const messaging = require('../messaging');
		const roomIds = await db.getSortedSetRange('chat:rooms:public', 0, -1);
		const roomData = await messaging.getRoomsData(roomIds);
		const bulkSet = [];
		roomData.forEach((room) => {
			if (room && room.public && Array.isArray(room.groups) && room.groups.includes(oldName)) {
				room.groups.splice(room.groups.indexOf(oldName), 1, newName);
				bulkSet.push([`chat:room:${room.roomId}`, { groups: JSON.stringify(room.groups) }]);
			}
		});
		await db.setObjectBulk(bulkSet);
	}
};
